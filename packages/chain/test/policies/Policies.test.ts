import { aggregatorAbi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { type Stock, stocks } from "@bluechip/chain/Contracts"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { http } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { agentOnNewAccount, changed, PICKER, trade, without } from "../support/Agents.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!
const aapl = stocks.find((stock) => stock.symbol === "AAPL")!
const tsla = stocks.find((stock) => stock.symbol === "TSLA")!

const agentWith = Effect.fnUntraced(function*(spec: AgentSpec) {
  return yield* agentOnNewAccount({ bundlerUrl: (yield* Devnet).bundlerUrl, fees: BASE_FEES, spec })
})

const feedPrice = Effect.fnUntraced(function*(stock: Stock) {
  const [, price] = yield* (yield* ChainClient).use(
    "latestRoundData",
    (client) => client.readContract({ address: stock.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
  )
  return price
})

// The stock's pool moved `bps` above Chainlink's price for the test, and put back after it.
const poolOff = (stock: Stock, bps: number) => <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const devnet = yield* Devnet
    const price = yield* feedPrice(stock)
    yield* devnet.movePool(stock.symbol, (price * BigInt(10_000 + bps)) / BigInt(10_000))
    return yield* test.pipe(Effect.ensuring(devnet.movePool(stock.symbol, price)))
  })

// What bluechip decides for one trade by a new agent with `spec`.
const decide = Effect.fnUntraced(function*(
  spec: AgentSpec,
  stock: Stock,
  side: "buy" | "sell",
  amountIn: bigint,
  holding?: bigint
) {
  const { address, agent } = yield* agentWith(spec)
  if (holding !== undefined) yield* (yield* Devnet).mintShares(address, stock.symbol, holding)
  return yield* simulateAsAgent(agent, trade(stock, side, amountIn, address))
})

const dollars = (amount: number) => BigInt(amount * 1_000_000)

layer(DevnetTest.layer)("simulateAsAgent", (it) => {
  describe("passes", () => {
    it.effect("a $50 buy of NVDA within every policy", () =>
      Effect.gen(function*() {
        const decision = yield* decide(PICKER, nvda, "buy", dollars(50))

        assert.strictEqual(decision._tag, "Passes")
      }))

    it.effect("the same buy by an agent carrying only the required policies", () =>
      Effect.gen(function*() {
        const decision = yield* decide(
          without(PICKER, "stockCap", "cashReserve", "slippageBudget"),
          nvda,
          "buy",
          dollars(50)
        )

        assert.strictEqual(decision._tag, "Passes")
      }))
  })

  describe("refused by trade", () => {
    it.effect("a stock it didn't pick", () =>
      Effect.gen(function*() {
        const decision = yield* decide(PICKER, tsla, "buy", dollars(20))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "trade",
            error: null,
            stock: null,
            message: "Not a trade it may make: another stock, the other direction, or over its budget or largest buy."
          }
        })
      }))

    it.effect("a buy by an agent that only sells", () =>
      Effect.gen(function*() {
        const decision = yield* decide(
          changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } }),
          nvda,
          "buy",
          dollars(20)
        )

        assert.strictEqual(decision._tag === "Refused" ? decision.refusal.policy : decision._tag, "trade")
      }))
  })

  describe("refused by tradeSize", () => {
    it.effect("a sale worth more than the largest trade", () =>
      Effect.gen(function*() {
        const decision = yield* decide(PICKER, nvda, "sell", BigInt(150_000_000), BigInt(200_000_000))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "tradeSize",
            error: "OverTradeSize",
            stock: "NVDA",
            message: "Bigger than the largest trade it makes on its own."
          }
        })
      }))

    it.effect("a buy under the smallest trade", () =>
      Effect.gen(function*() {
        const decision = yield* decide(PICKER, nvda, "buy", dollars(2))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "tradeSize",
            error: "TooSmall",
            stock: "NVDA",
            message: "Smaller than the smallest trade it makes."
          }
        })
      }))
  })

  describe("refused by fairPrice", () => {
    it.effect("a buy from a pool 5% off Chainlink's price", () =>
      poolOff(aapl, 500)(Effect.gen(function*() {
        const decision = yield* decide(PICKER, aapl, "buy", dollars(50))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "fairPrice",
            error: "UnfairPrice",
            stock: null,
            message: "Too far from Chainlink's price."
          }
        })
      })))

    it.effect("the same buy by an agent with a 10% collar", () =>
      poolOff(aapl, 500)(Effect.gen(function*() {
        const decision = yield* decide(
          changed(PICKER, { id: "fairPrice", config: { collarBps: 1000 } }),
          aapl,
          "buy",
          dollars(50)
        )

        assert.strictEqual(decision._tag, "Passes")
      })))
  })

  describe("refused by stockCap", () => {
    it.effect("a buy taking NVDA past 30%", () =>
      Effect.gen(function*() {
        // $400 of NVDA and $1,000 of cash: buying $100 more takes NVDA past 30%.
        const held = (BigInt(400) * BigInt(10) ** BigInt(16)) / (yield* feedPrice(nvda))

        const decision = yield* decide(PICKER, nvda, "buy", dollars(100), held)

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "stockCap",
            error: "OverStockCap",
            stock: "NVDA",
            message: "Would put too much of your money in NVDA."
          }
        })
      }))
  })

  describe("refused by cashReserve", () => {
    it.effect("a buy leaving 90% in cash, under a 95% reserve", () =>
      Effect.gen(function*() {
        const decision = yield* decide(
          changed(without(PICKER, "stockCap"), { id: "cashReserve", config: { minBps: 9500 } }),
          nvda,
          "buy",
          dollars(100)
        )

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "cashReserve",
            error: "UnderCashReserve",
            stock: null,
            message: "Would leave too little in cash."
          }
        })
      }))
  })

  describe("refused by rebalance", () => {
    it.effect("a buy while the mix is on target", () =>
      Effect.gen(function*() {
        // All cash, and a target of all cash: nothing to rebalance.
        const spec = changed(
          draftSpec({
            template: "rebalancer",
            preset: "balanced",
            stocks: ["NVDA"],
            targets: [{ asset: "NVDA", weight: 0 }, { asset: "USDC", weight: 10_000 }]
          }),
          { id: "fairPrice", config: { tradeWhilePaused: true } }
        )

        const decision = yield* decide(spec, nvda, "buy", dollars(50))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: { policy: "rebalance", error: "NotNeeded", stock: null, message: "Your mix is already on target." }
        })
      }))
  })

  describe("refused by slippageBudget", () => {
    it.effect("a buy losing 0.8% of $100, over a budget of 0.01% of $1,000", () =>
      poolOff(nvda, 80)(Effect.gen(function*() {
        const decision = yield* decide(
          changed(PICKER, { id: "slippageBudget", config: { weeklyBps: 1 } }),
          nvda,
          "buy",
          dollars(100)
        )

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "slippageBudget",
            error: "OverSlippageBudget",
            stock: null,
            message: "Would lose more to prices than this week's budget allows."
          }
        })
      })))
  })

  describe("refused by tradesPerDay", () => {
    it.effect("a second trade on a day with one", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* agentWith(changed(PICKER, { id: "tradesPerDay", config: { count: 1 } }))
        const first = yield* simulateAsAgent(agent, trade(nvda, "buy", dollars(20), address))
        yield* Effect.promise(async () => {
          const hash = await agent.sendUserOperation({
            calls: trade(nvda, "buy", dollars(20), address),
            callGasLimit: first._tag === "Passes" ? first.callGasLimit : undefined
          })
          return agent.waitForUserOperationReceipt({ hash })
        })

        const decision = yield* simulateAsAgent(agent, trade(nvda, "buy", dollars(20), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: { policy: "tradesPerDay", error: null, stock: null, message: "It has made all of today's trades." }
        })
      }))
  })

  describe("refused by gasBudget", () => {
    it.effect("any trade on a budget of 1 wei a day", () =>
      Effect.gen(function*() {
        const decision = yield* decide(
          changed(PICKER, { id: "gasBudget", config: { weiPerDay: BigInt(1) } }),
          nvda,
          "buy",
          dollars(20)
        )

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: { policy: "gasBudget", error: null, stock: null, message: "It has used today's gas." }
        })
      }))
  })

  describe("retry", () => {
    it.effect("a bundler that doesn't answer", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const { address, agent } = yield* agentWith(PICKER)
        const unreachable = createBundlerClient({
          account: agent.account!,
          client: chain.client,
          transport: http("http://localhost:1", { retryCount: 0 }),
          userOperation: { estimateFeesPerGas: async () => BASE_FEES }
        })

        const decision = yield* simulateAsAgent(unreachable, trade(nvda, "buy", dollars(20), address))

        assert.match(decision._tag === "Retry" ? decision.reason : decision._tag, /HTTP request failed/)
      }))
  })
})
