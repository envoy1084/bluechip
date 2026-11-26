import { RequestId } from "@bluechip/domain/Ids"
import { HistoryRange } from "@bluechip/domain/market/Market"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import {
  advanceLatest,
  agentIntent,
  approval,
  expireApprovals,
  ownFill,
  setApart,
  setCash,
  setFeeds,
  setHoldings,
  setMove,
  setSession
} from "../../../src/preview/panel/actions/market.ts"
import { castOf, type ScenarioId } from "../../../src/preview/world/cast.ts"
import { previewUuid } from "../../../src/preview/world/ids.ts"
import { previewApi } from "../../utils/PreviewApi.ts"

const credential: typeof AuthenticationCredential.Type = {
  id: "cHJldmlldy1wYXNza2V5",
  rawId: "cHJldmlldy1wYXNza2V5",
  type: "public-key",
  clientExtensionResults: {},
  response: { clientDataJSON: "e30", authenticatorData: "AA", signature: "AA" }
}

const SCENARIOS: ReadonlyArray<ScenarioId> = ["newPerson", "starter", "typical", "heavy"]

describe("preview market", () => {
  for (const scenario of SCENARIOS) {
    it.effect(`${scenario}: every read of the market groups decodes`, () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi(scenario)
        const cast = castOf(scenario)

        yield* client.market.status()
        const stocks = yield* client.market.stocks()
        for (const range of HistoryRange.literals) {
          const points = yield* client.market.history({ params: { symbol: "NVDA" }, query: { range } })
          assert.isAtLeast(points.length, 90)
        }
        yield* client.portfolio.portfolio()
        yield* client.portfolio.history()
        yield* client.performance.portfolio()
        for (const holding of cast.holdings) yield* client.performance.stock({ params: { symbol: holding.symbol } })
        for (const agent of cast.agents) yield* client.performance.agent({ params: { id: agent.id } })
        for (const automation of cast.automations) {
          yield* client.performance.automation({ params: { id: automation.id } })
        }
        for (const kind of ["all", "trades", "cash"] as const) {
          for (const period of ["7d", "30d", "all"] as const) yield* client.activity.list({ query: { kind, period } })
        }
        const intents = yield* client.intents.list({ query: { pageSize: 100 } })
        yield* client.intents.approvals()
        for (const intent of intents.items.slice(0, 5)) yield* client.intents.intent({ params: { id: intent.id } })

        assert.strictEqual(stocks.length, 13)
      }))
  }

  it.effect("newPerson: no money, trades or intents", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("newPerson")

      const portfolio = yield* client.portfolio.portfolio()
      const history = yield* client.portfolio.history()
      const activity = yield* client.activity.list({ query: {} })
      const intents = yield* client.intents.list({ query: {} })
      const performance = yield* client.performance.portfolio()

      assert.deepStrictEqual(
        [portfolio.value, portfolio.holdings.length, history.length, activity.items.length, intents.items.length],
        [BigInt(0), 0, 0, 0, 0]
      )
      assert.deepStrictEqual([performance.trades, performance.series.length], [0, 0])
    }))

  it.effect("starter: two small buys, one waiting for gas, and charts from the deposit", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("starter")

      const portfolio = yield* client.portfolio.portfolio()
      const history = yield* client.portfolio.history()
      const intents = yield* client.intents.list({ query: { pageSize: 100 } })
      const performance = yield* client.performance.portfolio()

      assert.deepStrictEqual(
        [portfolio.cash, portfolio.holdings.map((holding) => holding.symbol).sort()],
        [Usdc.make(BigInt(150_000_000)), ["AAPL", "NVDA"]]
      )
      assert.deepStrictEqual(intents.items.map((intent) => intent.status).sort(), ["filled", "filled", "waiting"])
      assert.isTrue(history.length >= 8 && history.length <= 10)
      assert.isTrue(history.every((point) => point.value > BigInt(150_000_000)))
      assert.strictEqual(performance.trades, 2)
      assert.isTrue(performance.series.length >= 2 && performance.series.length <= 3)
    }))

  it.effect("typical: holdings match the cast, the chart has 30 days and an approval waits", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const portfolio = yield* client.portfolio.portfolio()
      const history = yield* client.portfolio.history()
      const approvals = yield* client.intents.approvals()

      assert.deepStrictEqual(
        portfolio.holdings.map((holding) => holding.symbol).sort(),
        ["AAPL", "MSFT", "NVDA"]
      )
      assert.strictEqual(portfolio.cash, Usdc.make(BigInt(2_480_000_000)))
      assert.isAtLeast(history.length, 100)
      assert.isAtLeast(approvals.length, 2)
      assert.isTrue(approvals.every((intent) => intent.status === "needsApproval" && intent.batch !== null))
    }))

  it.effect("heavy: intents in every status and every wait reason, gains and losses", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("heavy")

      const intents = yield* client.intents.list({ query: { pageSize: 100 } })
      const performance = yield* client.performance.portfolio()
      const statuses = new Set(intents.items.map((intent) => intent.status))
      const reasons = new Set(
        intents.items.flatMap((intent) => intent.decision?._tag === "Wait" ? [intent.decision.reason] : [])
      )

      assert.deepStrictEqual(
        ["filled", "failed", "blocked", "waiting", "needsApproval", "declined", "expired", "cancelled"].filter((
          status
        ) => !statuses.has(status as never)),
        []
      )
      assert.strictEqual(reasons.size, 7)
      assert.isTrue(performance.stocks.some((line) => line.realised > BigInt(0)))
      assert.isTrue(performance.stocks.some((line) => line.realised < BigInt(0) || line.unrealised < BigInt(0)))
      assert.isAtLeast(performance.series.length, 150)
    }))

  it.effect("POST /api/trades then confirm: a buy is sent", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const request = yield* client.trades.prepare({
        payload: {
          requestId: RequestId.make(previewUuid(1)),
          symbol: "AAPL",
          side: "buy",
          amount: { usdc: Usdc.make(BigInt(50_000_000)) }
        }
      })
      const trade = yield* client.trades.confirm({ params: { id: request.id }, payload: { credential } })
      const fetched = yield* client.trades.trade({ params: { id: trade.id } })

      assert.deepStrictEqual([trade.status, trade.usdc, fetched.id], [
        "sending",
        Usdc.make(BigInt(50_000_000)),
        trade.id
      ])
    }))

  it.effect("POST /api/trades: more than the cash fails", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("newPerson")

      const error = yield* Effect.flip(client.trades.prepare({
        payload: {
          requestId: RequestId.make(previewUuid(2)),
          symbol: "AAPL",
          side: "buy",
          amount: { usdc: Usdc.make(BigInt(5_000_000)) }
        }
      }))

      assert.strictEqual(error._tag, "InsufficientCash")
    }))

  it.effect("POST /api/market/quotes: a sale is quoted against Chainlink", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const quote = yield* client.market.quote({
        payload: { symbol: "NVDA", side: "sell", amount: { shares: Shares.make(BigInt(100_000_000)) } }
      })

      assert.deepStrictEqual([quote.side, quote.shares, quote.reference.status], [
        "sell",
        Shares.make(BigInt(100_000_000)),
        "live"
      ])
      assert.isAtLeast(quote.gapBps, 0)
    }))

  it.effect("POST /api/intents yourself, then confirm: the intent is sent", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const request = yield* client.intents.create({
        payload: {
          requestId: RequestId.make(previewUuid(3)),
          agentId: null,
          leg: { symbol: "MSFT", side: "buy", amount: { usdc: Usdc.make(BigInt(20_000_000)) } }
        }
      })
      if (!("options" in request)) return assert.fail("expected a request for your passkey")
      const intent = yield* client.intents.confirm({ params: { id: request.id }, payload: { credential } })

      assert.deepStrictEqual([intent.status, intent.executor, intent.tradeId === null], ["sending", "owner", false])
    }))

  it.effect("POST /api/intents through an agent: proposed, decided later", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")
      const picker = castOf("typical").agents[0]!

      const created = yield* client.intents.create({
        payload: {
          requestId: RequestId.make(previewUuid(4)),
          agentId: picker.id,
          leg: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(BigInt(100_000_000)) } }
        }
      })
      const decision = yield* client.intents.preview({
        payload: {
          agentId: picker.id,
          leg: { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(BigInt(100_000_000)) } }
        }
      })

      assert.deepStrictEqual(["status" in created ? created.status : null, decision._tag], ["proposed", "Passes"])
    }))

  it.effect("POST /api/intents/:id/approve: one leg per stock of the plan is signed together, the next wave waits", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("heavy")
      const [first] = yield* client.intents.approvals()

      const request = yield* client.intents.approve({
        params: { id: first!.id },
        payload: { requestId: RequestId.make(previewUuid(5)) }
      })
      const approvals = yield* client.intents.approvals()

      assert.strictEqual(request.together.length, 1)
      assert.deepStrictEqual(approvals.map((intent) => intent.status).sort(), [
        "awaitingSignature",
        "awaitingSignature",
        "needsApproval"
      ])
    }))

  it.effect("POST /api/intents/:id/decline, then again: 409", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")
      const [first] = yield* client.intents.approvals()

      const declined = yield* client.intents.decline({ params: { id: first!.id } })
      const again = yield* Effect.flip(client.intents.decline({ params: { id: first!.id } }))

      assert.deepStrictEqual([declined.status, again._tag], ["declined", "Conflict"])
    }))

  it.effect("POST /api/intents/:id/cancel: a waiting intent is cancelled", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")
      const waiting = yield* client.intents.list({ query: { status: "waiting" } })

      const cancelled = yield* client.intents.cancel({ params: { id: waiting.items[0]!.id } })

      assert.strictEqual(cancelled.status, "cancelled")
    }))

  describe("panel actions", () => {
    it.effect("a weekend pauses the market and Chainlink", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")

        setSession.def.apply(store.world, "weekend")
        const status = yield* client.market.status()
        const stocks = yield* client.market.stocks()

        assert.deepStrictEqual([status.session, status.pausedFor], ["paused", "weekend"])
        assert.isTrue(stocks.every((stock) => stock.reference?.status === "paused"))
      }))

    it.effect("a big down day moves every stock down", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")

        setMove.def.apply(store.world, "bigDown")
        const stocks = yield* client.market.stocks()
        const portfolio = yield* client.portfolio.portfolio()

        assert.isTrue(stocks.every((stock) => (stock.change24h ?? 0) < -400))
        assert.isBelow(Number(portfolio.change24h), 0)
      }))

    it.effect("stale Chainlink prices fail the price check", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")

        setFeeds.def.apply(store.world, "stale")
        const error = yield* Effect.flip(client.trades.prepare({
          payload: {
            requestId: RequestId.make(previewUuid(6)),
            symbol: "AAPL",
            side: "buy",
            amount: { usdc: Usdc.make(BigInt(10_000_000)) }
          }
        }))

        assert.deepStrictEqual(error._tag === "PriceCheckFailed" ? error.reason : error._tag, "stale")
      }))

    it.effect("the market apart from Chainlink is a warning; the pools apart fail the check", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        const payload = { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(BigInt(10_000_000)) } } as const

        setApart.def.apply(store.world, "market")
        const warned = yield* client.trades.prepare({
          payload: { ...payload, requestId: RequestId.make(previewUuid(7)) }
        })
        setApart.def.apply(store.world, "pool")
        const error = yield* Effect.flip(
          client.trades.prepare({ payload: { ...payload, requestId: RequestId.make(previewUuid(8)) } })
        )

        assert.deepStrictEqual([warned.warnings, error._tag === "PriceCheckFailed" ? error.reason : error._tag], [[
          "marketApart"
        ], "gap"])
      }))

    it.effect("lots of cash arrives as a deposit", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("newPerson")

        setCash.def.apply(store.world, "lots")
        const portfolio = yield* client.portfolio.portfolio()
        const cash = yield* client.activity.list({ query: { kind: "cash" } })

        assert.strictEqual(portfolio.cash, Usdc.make(BigInt(1_248_350_750_000)))
        assert.deepStrictEqual(cash.items.map((item) => item._tag === "Withdrawal" ? item.transfer.kind : item._tag), [
          "deposit"
        ])
      }))

    it.effect("many holdings show as shares found outside bluechip", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")

        setHoldings.def.apply(store.world, "many")
        const portfolio = yield* client.portfolio.portfolio()
        const performance = yield* client.performance.portfolio()

        assert.strictEqual(portfolio.holdings.length, 13)
        assert.isAtLeast(performance.flagged, 10)
      }))

    it.effect("a plan of 3 waits in two waves", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        const keeper = castOf("typical").agents[2]!

        expireApprovals.def.apply(store.world)
        approval.def.apply(store.world, keeper.id, 3)
        const approvals = yield* client.intents.approvals()

        assert.deepStrictEqual(approvals.map((intent) => intent.batch?.wave).sort(), [0, 0, 1])
      }))

    it.effect("an agent's trade filled at once moves the cash", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        const picker = castOf("typical").agents[0]!

        agentIntent.def.apply(store.world, picker.id, "filled")
        const [latest] = (yield* client.intents.list({ query: { agentId: picker.id, pageSize: 1 } })).items
        const trade = yield* client.trades.trade({ params: { id: latest!.tradeId! } })
        const portfolio = yield* client.portfolio.portfolio()

        assert.deepStrictEqual([latest!.status, trade.status], ["filled", "filled"])
        assert.strictEqual(portfolio.cash, Usdc.make(BigInt(2_480_000_000) - trade.usdc))
      }))

    it.effect("an agent's trade waiting for gas, then one sent and advanced", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("typical")
        const picker = castOf("typical").agents[0]!

        agentIntent.def.apply(store.world, picker.id, "wait:noGas")
        const [waiting] = (yield* client.intents.list({ query: { agentId: picker.id, pageSize: 1 } })).items
        agentIntent.def.apply(store.world, picker.id, "sending")
        advanceLatest.def.apply(store.world, picker.id, "confirming")
        const [sent] = (yield* client.intents.list({ query: { agentId: picker.id, pageSize: 1 } })).items

        assert.deepStrictEqual(
          [waiting!.status, waiting!.decision?._tag === "Wait" ? waiting!.decision.reason : null, sent!.status],
          ["waiting", "noGas", "confirming"]
        )
      }))

    it.effect("your own buy without cash is funded, then filled", () =>
      Effect.gen(function*() {
        const { client, store } = yield* previewApi("newPerson")

        ownFill.def.apply(store.world, "NVDA", 250)
        const portfolio = yield* client.portfolio.portfolio()
        const activity = yield* client.activity.list({ query: {} })

        assert.deepStrictEqual(
          [portfolio.cash, portfolio.holdings.map((holding) => holding.symbol), activity.items.length],
          [Usdc.make(BigInt(0)), ["NVDA"], 2]
        )
      }))
  })
})
