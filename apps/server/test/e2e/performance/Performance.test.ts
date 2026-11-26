import { Devnet } from "@bluechip/devnet/Devnet"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { NotFound } from "@bluechip/domain/Errors"
import { AutomationId, RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import { RunCount } from "@bluechip/domain/performance/Performance"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { ScheduleWatcher } from "../../../src/modules/automations/watchers/ScheduleWatcher.ts"
import { Drift } from "../../../src/modules/performance/Drift.ts"
import { AccountBalances } from "../../../src/modules/portfolio/AccountBalances.ts"
import { AROUND_THE_CLOCK, weeklyBuy } from "../../fixtures/Automations.ts"
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

    it.effect("a rebalancer measured all in cash, then with Microsoft in: its drift history against its 5% trigger", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const user = yield* (yield* TestUsers).funded
        // 30% Microsoft, 70% cash.
        const spec = draftSpec({
          template: "rebalancer",
          preset: "balanced",
          stocks: ["MSFT"],
          targets: [{ asset: "MSFT", weight: 3000 }, { asset: "USDC", weight: 7000 }]
        })
        const { agent } = yield* agents.sign(
          user,
          yield* Effect.orDie(agents.create(user, { template: "rebalancer", spec })),
          "active"
        )
        const drift = yield* Drift

        // $1,000 of cash: Microsoft 30% under its target.
        yield* drift.measure({ userId: user.id })
        // 5 Microsoft tokens at the market's $100 (its token is one share): $500 of $1,500, Microsoft at 33.33% and
        // cash at 66.66%, 3.34% off. Minted outside bluechip: nothing it does invalidates the account's cached
        // balances, so the test does.
        yield* (yield* Devnet).mintShares(user.account, "MSFT", 500_000_000n)
        yield* (yield* AccountBalances).invalidate(user.account)
        yield* drift.measure({ userId: user.id })
        const performance = yield* user.api.performance.agent({ params: { id: agent.id } })

        assert.deepStrictEqual(performance.drift?.map((point) => [point.driftBps, point.triggerBps]), [
          [3000, 500],
          [334, 500]
        ])
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
    it.effect("an agent's weekly buy fired and filled: one run proposed, one $50 trade bought, its costs", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const saved = yield* user.api.automations.create({
          payload: {
            requestId: RequestId.make(randomUUID()),
            draft: new AutomationDraft({
              ...weeklyBuy(agent.id),
              settings: { ...DEFAULT_SETTINGS, ...AROUND_THE_CLOCK }
            })
          }
        })

        yield* (yield* ScheduleWatcher).runDue(DateTime.add(saved.nextRunAt!, { seconds: 1 }), { userId: user.id })
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "filled"
        )
        const results = yield* user.api.performance.automation({ params: { id: saved.id } })

        assert.deepStrictEqual(
          [results.runs, results.outcomes, results.trades, results.bought, results.sold, results.realised],
          [1, [new RunCount({ outcome: "proposed", count: 1 })], 1, 50_000_000n, 0n, 0n]
        )
        // The pool's fee and the gas are what the chain charged.
        assert.deepStrictEqual([results.costs.fees > 0n, results.costs.gasWei > 0n], [true, true])
      }))

    it.effect("404: an automation that doesn't exist", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const id = AutomationId.make(typeid("automation").toString())

        const error = yield* Effect.flip(api.performance.automation({ params: { id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "automation", id }) })
      }))
  })
})
