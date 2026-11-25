import { aggregatorAbi } from "@bluechip/chain/Abis"
import { guardedTradeCallGas } from "@bluechip/chain/agents/Policies"
import { refusalFrom } from "@bluechip/chain/agents/Violations"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { type Stock, stocks, usdc } from "@bluechip/chain/Contracts"
import { quoteExactIn } from "@bluechip/chain/market/Quotes"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { evaluate } from "@bluechip/domain/agents/Evaluate"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { agentOnNewAccount as agentOn, balanceOf, LIMITS, trade } from "../support/Agents.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!
const aapl = stocks.find((stock) => stock.symbol === "AAPL")!
const tsla = stocks.find((stock) => stock.symbol === "TSLA")!

const agentOnNewAccount = Effect.fnUntraced(function*() {
  return yield* agentOn({ bundlerUrl: (yield* Devnet).bundlerUrl, fees: BASE_FEES })
})

const feedPrice = Effect.fnUntraced(function*(stock: Stock) {
  const [, price] = yield* (yield* ChainClient).use(
    "latestRoundData",
    (client) => client.readContract({ address: stock.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
  )
  return price
})

layer(DevnetTest.layer)("an agent's session", (it) => {
  describe("within its limits", () => {
    it.effect("a buy of $50 of NVDA fills at the quote", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const { address, agent } = yield* agentOnNewAccount()
        const amountIn = BigInt(50_000_000)
        const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })

        const receipt = yield* Effect.promise(async () => {
          const calls = trade(nvda, "buy", amountIn, address, (quoted * BigInt(99)) / BigInt(100))
          const hash = await agent.sendUserOperation({ calls, callGasLimit: guardedTradeCallGas })
          return agent.waitForUserOperationReceipt({ hash })
        })

        assert.isTrue(receipt.success)
        assert.strictEqual(yield* balanceOf(nvda.token, address), quoted)
      }))
  })

  describe("under the call gas floor", () => {
    it.effect("a buy at the bundler's call gas estimate reverts in Aerodrome's swap hook", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount()

        const receipt = yield* Effect.promise(async () => {
          const hash = await agent.sendUserOperation({ calls: trade(nvda, "buy", BigInt(50_000_000), address) })
          return agent.waitForUserOperationReceipt({ hash })
        })

        assert.isFalse(receipt.success)
        assert.strictEqual(yield* balanceOf(nvda.token, address), BigInt(0))
      }))
  })

  describe("refused before it reaches the chain", () => {
    it.effect("a stock the agent can't trade", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount()

        const failure = yield* Effect.promise(() =>
          agent.sendUserOperation({ calls: trade(tsla, "buy", BigInt(20_000_000), address) }).then(
            () => undefined,
            (error: unknown) => error
          )
        )

        assert.deepStrictEqual(refusalFrom(failure), { layer: "validation" })
        assert.strictEqual(yield* balanceOf(usdc, address), BigInt(1_000_000_000))
      }))
  })

  describe("refused onchain by TradeGuard", () => {
    // AAPL's pool, pushed 5% above Chainlink's price for the test and put back after it.
    const offPrice = Effect.fnUntraced(function*<A, E, R>(test: Effect.Effect<A, E, R>) {
      const devnet = yield* Devnet
      const price = yield* feedPrice(aapl)
      yield* devnet.movePool("AAPL", (price * BigInt(105)) / BigInt(100))
      return yield* test.pipe(Effect.ensuring(devnet.movePool("AAPL", price)))
    })

    it.effect("a buy from a pool 5% off Chainlink's price", () =>
      offPrice(Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount()

        const failure = yield* Effect.promise(() =>
          agent.sendUserOperation({ calls: trade(aapl, "buy", BigInt(50_000_000), address) }).then(
            () => undefined,
            (error: unknown) => error
          )
        )

        assert.deepStrictEqual(refusalFrom(failure), { layer: "execution", rule: "unfairPrice", symbol: null })
      })))

    it.effect("the same buy, sent anyway, reverts and keeps the cash", () =>
      offPrice(Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount()

        const receipt = yield* Effect.promise(async () => {
          const hash = await agent.sendUserOperation({
            calls: trade(aapl, "buy", BigInt(50_000_000), address),
            callGasLimit: BigInt(2_000_000),
            verificationGasLimit: BigInt(9_000_000),
            preVerificationGas: BigInt(200_000)
          })
          return agent.waitForUserOperationReceipt({ hash })
        })

        assert.isFalse(receipt.success)
        assert.deepStrictEqual(refusalFrom(receipt.reason), { layer: "execution", rule: "unfairPrice", symbol: null })
        assert.strictEqual(yield* balanceOf(usdc, address), BigInt(1_000_000_000))
        assert.strictEqual(yield* balanceOf(aapl.token, address), BigInt(0))
      })))

    it.effect("a sell worth more than the most per trade", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount()
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(200_000_000))

        const failure = yield* Effect.promise(() =>
          agent.sendUserOperation({ calls: trade(nvda, "sell", BigInt(150_000_000), address) }).then(
            () => undefined,
            (error: unknown) => error
          )
        )

        assert.deepStrictEqual(refusalFrom(failure), { layer: "execution", rule: "overTradeSize", symbol: "NVDA" })
      }))

    it.effect("a buy bluechip would block, sent straight to the bundler, is blocked for the same rule", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const { address, agent } = yield* agentOnNewAccount()
        // $400 of NVDA and $1,000 of cash: buying $100 more takes NVDA past 30%.
        const price = yield* feedPrice(nvda)
        const held = (BigInt(400) * BigInt(10) ** BigInt(16)) / price
        yield* (yield* Devnet).mintShares(address, "NVDA", held)
        const amountIn = BigInt(100_000_000)
        const quoted = yield* quoteExactIn(chain, { pool: nvda.pool!.address, tokenIn: usdc, amountIn })

        const offchain = evaluate({
          limits: LIMITS,
          holdings: { usdc: Usdc.make(BigInt(1_000_000_000)), shares: { NVDA: Shares.make(held) } },
          prices: { NVDA: { price: Price.make(price), ageSeconds: 60 } },
          usage: {
            spentToday: Usdc.make(BigInt(0)),
            tradesToday: 0,
            slippage: { used: Usdc.make(BigInt(0)), updatedAt: 0 }
          },
          legs: [{ symbol: "NVDA", side: "buy", amountIn, amountOut: quoted }],
          now: DateTime.nowUnsafe()
        })
        const failure = yield* Effect.promise(() =>
          agent.sendUserOperation({ calls: trade(nvda, "buy", amountIn, address) }).then(
            () => undefined,
            (error: unknown) => error
          )
        )

        assert.deepStrictEqual(
          offchain._tag === "Blocked" ? offchain.violations.map((violation) => violation.rule) : [],
          ["overStockCap"]
        )
        assert.deepStrictEqual(refusalFrom(failure), { layer: "execution", rule: "overStockCap", symbol: "NVDA" })
      }))
  })
})
