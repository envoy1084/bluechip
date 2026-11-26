import { aggregatorAbi } from "@bluechip/chain/Abis"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { dollars } from "@bluechip/domain/policies/Format"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { http } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { aapl, nvda, tradeCalls, tsla } from "../../fixtures/Market.ts"
import { changed, PICKER, without } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

layer(Layer.provideMerge(TestAgents.layer, DevnetTest.layer))("simulateAsAgent", (it) => {
  describe("passes", () => {
    it.effect("a $50 buy of NVDA within every policy", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(50), address))

        assert.strictEqual(decision._tag, "Passes")
      }))

    it.effect("the same buy by an agent carrying only the required policies", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: without(PICKER, "stockCap", "cashReserve", "slippageBudget")
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(50), address))

        assert.strictEqual(decision._tag, "Passes")
      }))
  })

  describe("a batch", () => {
    it.effect("a sale of NVDA and a buy of AAPL in one operation", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(20_000_000))

        const decision = yield* simulateAsAgent(agent, [
          ...tradeCalls(nvda, "sell", BigInt(20_000_000), address),
          ...tradeCalls(aapl, "buy", dollars(50), address)
        ])

        assert.strictEqual(decision._tag, "Passes")
      }))

    it.effect("the same batch with its buy over the largest trade: refused whole", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(20_000_000))

        const decision = yield* simulateAsAgent(agent, [
          ...tradeCalls(nvda, "sell", BigInt(20_000_000), address),
          ...tradeCalls(aapl, "buy", dollars(150), address)
        ])

        assert.strictEqual(decision._tag === "Refused" ? decision.refusal.policy : decision._tag, "trade")
      }))

    it.effect("two $60 buys of NVDA in one operation: their $120 is over the largest trade", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()

        const decision = yield* simulateAsAgent(agent, [
          ...tradeCalls(nvda, "buy", dollars(60), address),
          ...tradeCalls(nvda, "buy", dollars(60), address)
        ])

        assert.deepStrictEqual(
          decision._tag === "Refused" ? [decision.refusal.policy, decision.refusal.error] : decision._tag,
          ["tradeSize", "OverTradeSize"]
        )
      }))
  })

  describe("refused by trade", () => {
    it.effect("a stock it didn't pick", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()

        const decision = yield* simulateAsAgent(agent, tradeCalls(tsla, "buy", dollars(20), address))

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
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } })
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(20), address))

        assert.strictEqual(decision._tag === "Refused" ? decision.refusal.policy : decision._tag, "trade")
      }))
  })

  describe("refused by tradeSize", () => {
    it.effect("a sale worth more than the largest trade", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock()
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(200_000_000))

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "sell", BigInt(150_000_000), address))

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
        const { address, agent } = yield* (yield* TestAgents).lock()

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(2), address))

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
      Effect.gen(function*() {
        const devnet = yield* Devnet
        const [, price] = yield* (yield* ChainClient).use(
          "latestRoundData",
          (client) => client.readContract({ address: aapl.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
        )
        yield* Effect.acquireRelease(
          devnet.movePool("AAPL", (price * BigInt(10500)) / BigInt(10_000)),
          () => devnet.movePool("AAPL", price)
        )
        const { address, agent } = yield* (yield* TestAgents).lock()

        const decision = yield* simulateAsAgent(agent, tradeCalls(aapl, "buy", dollars(50), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "fairPrice",
            error: "UnfairPrice",
            stock: null,
            message: "Too far from Chainlink's price."
          }
        })
      }))

    it.effect("the same buy by an agent with a 10% collar", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        const [, price] = yield* (yield* ChainClient).use(
          "latestRoundData",
          (client) => client.readContract({ address: aapl.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
        )
        yield* Effect.acquireRelease(
          devnet.movePool("AAPL", (price * BigInt(10500)) / BigInt(10_000)),
          () => devnet.movePool("AAPL", price)
        )
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: changed(PICKER, { id: "fairPrice", config: { collarBps: 1000 } })
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(aapl, "buy", dollars(50), address))

        assert.strictEqual(decision._tag, "Passes")
      }))
  })

  describe("refused by stockCap", () => {
    it.effect("a buy taking NVDA past 30%", () =>
      Effect.gen(function*() {
        // $400 of NVDA and $1,000 of cash: buying $100 more takes NVDA past 30%.
        const [, price] = yield* (yield* ChainClient).use(
          "latestRoundData",
          (client) => client.readContract({ address: nvda.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
        )
        const held = (BigInt(400) * BigInt(10) ** BigInt(16)) / price

        const { address, agent } = yield* (yield* TestAgents).lock()
        yield* (yield* Devnet).mintShares(address, "NVDA", held)

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(100), address))

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
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: changed(without(PICKER, "stockCap"), { id: "cashReserve", config: { minBps: 9500 } })
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(100), address))

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

        const { address, agent } = yield* (yield* TestAgents).lock({ spec })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(50), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: { policy: "rebalance", error: "NotNeeded", stock: null, message: "Your mix is already on target." }
        })
      }))
  })

  describe("refused by stopLossFloor", () => {
    // A Stop-loss guard holding one NVDA, selling a tenth of it (about $18).
    const guard = (floor: bigint) =>
      changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } }, {
        id: "stopLossFloor",
        config: { floors: [{ symbol: "NVDA", price: floor }, { symbol: "AAPL", price: floor }] }
      })

    it.effect("a sale of NVDA above its floor", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock({ spec: guard(BigInt(1)) })
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(100_000_000))

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "sell", BigInt(10_000_000), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "stopLossFloor",
            error: "AboveFloor",
            stock: "NVDA",
            message: "Would sell NVDA above the floor you set."
          }
        })
      }))

    it.effect("the same sale under a floor of $10,000", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock({ spec: guard(BigInt(1_000_000_000_000)) })
        yield* (yield* Devnet).mintShares(address, "NVDA", BigInt(100_000_000))

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "sell", BigInt(10_000_000), address))

        assert.strictEqual(decision._tag, "Passes")
      }))
  })

  describe("refused by slippageBudget", () => {
    it.effect("a buy losing 0.8% of $100, over a budget of 0.01% of $1,000", () =>
      Effect.gen(function*() {
        const devnet = yield* Devnet
        const [, price] = yield* (yield* ChainClient).use(
          "latestRoundData",
          (client) => client.readContract({ address: nvda.feed, abi: aggregatorAbi, functionName: "latestRoundData" })
        )
        yield* Effect.acquireRelease(
          devnet.movePool("NVDA", (price * BigInt(10080)) / BigInt(10_000)),
          () => devnet.movePool("NVDA", price)
        )
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: changed(PICKER, { id: "slippageBudget", config: { weeklyBps: 1 } })
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(100), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: {
            policy: "slippageBudget",
            error: "OverSlippageBudget",
            stock: null,
            message: "Would lose more to prices than this week's budget allows."
          }
        })
      }))
  })

  describe("refused by tradesPerDay", () => {
    it.effect("a second trade on a day with one", () =>
      Effect.gen(function*() {
        const { address, agent, trade } = yield* (yield* TestAgents).lock({
          spec: changed(PICKER, { id: "tradesPerDay", config: { count: 1 } })
        })
        const first = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(20), address))
        yield* trade(
          tradeCalls(nvda, "buy", dollars(20), address),
          first._tag === "Passes" ? first.callGasLimit : undefined
        )

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(20), address))

        assert.deepStrictEqual(decision, {
          _tag: "Refused",
          refusal: { policy: "tradesPerDay", error: null, stock: null, message: "It has made all of today's trades." }
        })
      }))
  })

  describe("refused by gasBudget", () => {
    it.effect("any trade on a budget of 1 wei a day", () =>
      Effect.gen(function*() {
        const { address, agent } = yield* (yield* TestAgents).lock({
          spec: changed(PICKER, { id: "gasBudget", config: { weiPerDay: BigInt(1) } })
        })

        const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", dollars(20), address))

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
        const { address, agent } = yield* (yield* TestAgents).lock()
        const unreachable = createBundlerClient({
          account: agent.account!,
          client: chain.client,
          transport: http("http://localhost:1", { retryCount: 0 }),
          userOperation: { estimateFeesPerGas: async () => BASE_FEES }
        })

        const decision = yield* simulateAsAgent(unreachable, tradeCalls(nvda, "buy", dollars(20), address))

        assert.match(decision._tag === "Retry" ? decision.reason : decision._tag, /HTTP request failed/)
      }))
  })
})
