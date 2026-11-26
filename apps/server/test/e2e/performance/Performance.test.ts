import { Devnet } from "@bluechip/devnet/Devnet"
import { NotFound } from "@bluechip/domain/Errors"
import { AutomationId, RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { buy } from "../../fixtures/Legs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("performance", (it) => {
  describe("GET /api/performance", () => {
    it.effect("a new user: nothing made or lost, one point for today", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const performance = yield* api.performance.portfolio()

        assert.deepStrictEqual(
          [
            performance.realised,
            performance.unrealised,
            performance.cost,
            performance.value,
            performance.trades,
            performance.flagged,
            performance.stocks,
            performance.agents,
            performance.series.map((point) => point.total)
          ],
          [BigInt(0), BigInt(0), BigInt(0), BigInt(0), 0, 0, [], [], [BigInt(0)]]
        )
        assert.match(performance.series[0]!.day, /^\d{4}-\d{2}-\d{2}$/)
      }))

    it.effect("after a buy: the stock's line at what it cost, and the trade's costs", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const prepared = yield* user.api.trades.prepare({
          payload: {
            requestId: RequestId.make(randomUUID()),
            symbol: "NVDA",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(100_000_000)) }
          }
        })
        const sent = yield* user.api.trades.confirm({
          params: { id: prepared.id },
          payload: { credential: user.authenticator.authenticate(prepared.options) }
        })
        const { trade } = yield* user.events.next("TradeUpdated", ({ trade }) => trade.id === sent.id)

        const performance = yield* user.api.performance.portfolio()

        assert.deepStrictEqual(
          performance.stocks.map((line) => [line.symbol, line.shares, line.cost, line.realised]),
          [["NVDA", trade.shares, BigInt(100_000_000), BigInt(0)]]
        )
        assert.deepStrictEqual([performance.trades, performance.cost], [1, BigInt(100_000_000)])
        assert.isTrue(performance.costs.fees > BigInt(0))
        assert.isTrue(performance.costs.gasWei > BigInt(0))
      }))
  })

  describe("GET /api/performance/stocks/:symbol", () => {
    it.effect("a stock never bought: no shares, no lots", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const stock = yield* api.performance.stock({ params: { symbol: "AAPL" } })

        assert.deepStrictEqual(
          [stock.symbol, stock.shares, stock.cost, stock.value, stock.realised, stock.trades, stock.lots],
          ["AAPL", BigInt(0), BigInt(0), BigInt(0), BigInt(0), 0, []]
        )
      }))
  })

  describe("GET /api/performance/agents/:id", () => {
    it.effect("a buy its cap in one stock blocked: one decided, one blocked by that policy", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(300_000_000))
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 100) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "blocked"
        )

        const performance = yield* user.api.performance.agent({ params: { id: agent.id } })

        assert.deepStrictEqual(
          [
            performance.agentId,
            performance.decided,
            performance.blocked,
            performance.blockedBy.map((row) => [row.policy, row.count]),
            performance.trades,
            performance.drift
          ],
          [agent.id, 1, 1, [["stockCap", 1]], 0, null]
        )
      }))

    it.effect("404: another user's agent", () =>
      Effect.gen(function*() {
        const { agent } = yield* (yield* TestAgents).locked
        const stranger = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(stranger.api.performance.agent({ params: { id: agent.id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "agent", id: agent.id }) })
      }))
  })

  describe("GET /api/performance/automations/:id", () => {
    it.effect("404: an automation that doesn't exist", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const id = AutomationId.make(typeid("automation").toString())

        const error = yield* Effect.flip(api.performance.automation({ params: { id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "automation", id }) })
      }))
  })
})
