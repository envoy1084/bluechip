import { RunResult, runResultOf } from "@bluechip/domain/automations/Run"
import { NotFound } from "@bluechip/domain/Errors"
import type { AgentId, AutomationId, UserId } from "@bluechip/domain/Ids"
import { dayOf, series } from "@bluechip/domain/ledger/Daily"
import { unrealised } from "@bluechip/domain/ledger/Lots"
import type { MarketPrice, StockSymbol } from "@bluechip/domain/market/Market"
import { Shares, Usdc, valueOf } from "@bluechip/domain/market/Units"
import {
  AgentLine,
  AgentPerformance,
  AutomationPerformance,
  BlockedBy,
  Costs,
  DriftPoint,
  type HeldLot,
  PnlPoint,
  PortfolioPerformance,
  RunCount,
  StockLine,
  StockPerformance
} from "@bluechip/domain/performance/Performance"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { and, asc, count, eq, gte, inArray, isNotNull, lt, ne, sql, sum } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../platform/db/Database.ts"
import { agents } from "../agents/tables.ts"
import { automationRuns, automations } from "../automations/tables.ts"
import { intents } from "../intents/tables.ts"
import { Ledger } from "../ledger/Ledger.ts"
import { ledgerAdjustments, lotClosings, pnlDaily } from "../ledger/tables.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { trades } from "../trading/tables.ts"
import { driftHistory } from "./tables.ts"

const zero = BigInt(0)

type DailyRow = typeof pnlDaily.$inferSelect

const DRIFT_KEPT = { days: 30 }

const costsOf = (rows: ReadonlyArray<Pick<DailyRow, "fees" | "slippage" | "gasWei">>) =>
  new Costs({
    fees: rows.reduce((total, row) => total + row.fees, zero),
    slippage: rows.reduce((total, row) => total + row.slippage, zero),
    gasWei: rows.reduce((total, row) => total + row.gasWei, zero)
  })

const valued = (lots: ReadonlyArray<HeldLot>, prices: ReadonlyMap<StockSymbol, MarketPrice>) => {
  const shares = lots.reduce((total, lot) => total + lot.remaining, zero)
  const cost = lots.reduce((total, lot) => total + lot.remainingCost, zero)
  const price = prices.get(lots[0]?.symbol as StockSymbol)?.price
  return {
    shares: Shares.make(shares),
    cost: Usdc.make(cost),
    value: Usdc.make(price === undefined ? zero : valueOf(Shares.make(shares), price)),
    unrealised: price === undefined ? zero : unrealised(lots, price)
  }
}

/**
 * Performance, read from the ledger at market prices: the portfolio's, one stock's, one agent's and one automation's
 * profit, costs and trades, and rebalancing agents' drift (recorded each hour).
 */
export class Performance extends Context.Service<Performance, {
  readonly portfolio: (userId: UserId) => Effect.Effect<PortfolioPerformance>
  readonly stock: (userId: UserId, symbol: StockSymbol) => Effect.Effect<StockPerformance>
  readonly agent: (owner: Owner, agentId: AgentId) => Effect.Effect<AgentPerformance, NotFound>
  readonly automation: (owner: Owner, automationId: AutomationId) => Effect.Effect<AutomationPerformance, NotFound>
  /** Records how far a rebalancing agent's account is from its target mix now, and drops points past 30 days. */
  readonly recordDrift: (point: {
    readonly agentId: AgentId
    readonly userId: UserId
    readonly driftBps: number
    readonly triggerBps: number
  }) => Effect.Effect<void>
}>()("@bluechip/server/Performance") {
  static readonly layer = Layer.effect(
    Performance,
    Effect.gen(function*() {
      const db = yield* Database
      const ledger = yield* Ledger
      const market = yield* MarketPrices

      // The profit chart of `rows`, its last day at the live unrealised value instead of the last hourly one.
      const chartOf = Effect.fnUntraced(function*(rows: ReadonlyArray<DailyRow>, live: bigint) {
        const today = dayOf(yield* DateTime.now)
        return series([
          ...rows.map((row) => ({
            day: row.day,
            realised: row.realised,
            unrealised: row.day === today ? null : row.unrealised
          })),
          { day: today, realised: zero, unrealised: live }
        ]).map((point) => new PnlPoint(point))
      })

      const dailyOf = (userId: UserId, filter?: ReturnType<typeof eq>) =>
        db.select().from(pnlDaily).where(and(eq(pnlDaily.userId, userId as `user_${string}`), filter))
          .orderBy(asc(pnlDaily.day)).pipe(Effect.orDie)

      const portfolio = Effect.fn("Performance.portfolio")(function*(userId: UserId) {
        const prices = yield* market.prices
        const held = yield* ledger.openLots(userId)
        const rows = yield* dailyOf(userId)

        const symbols = [...new Set([...held.map((lot) => lot.symbol), ...rows.map((row) => row.symbol)])]
        const stocks = symbols.map((symbol) => {
          const position = valued(held.filter((lot) => lot.symbol === symbol), prices)
          return new StockLine({
            symbol: symbol as StockSymbol,
            ...position,
            realised: rows.filter((row) => row.symbol === symbol).reduce((total, row) => total + row.realised, zero)
          })
        }).sort((a, b) => (a.value === b.value ? 0 : a.value > b.value ? -1 : 1))

        const agentIds = [...new Set(rows.flatMap((row) => (row.agentId === null ? [] : [row.agentId])))]
        const names = agentIds.length === 0 ? [] : yield* db.select({ id: agents.id, name: agents.name })
          .from(agents).where(inArray(agents.id, agentIds)).pipe(Effect.orDie)
        const agentLines = agentIds.map((agentId) => {
          const own = rows.filter((row) => row.agentId === agentId)
          const lots = held.filter((lot) => lot.agentId === agentId)
          return new AgentLine({
            agentId: agentId as AgentId,
            name: names.find((agent) => agent.id === agentId)?.name ?? "An agent",
            realised: own.reduce((total, row) => total + row.realised, zero),
            unrealised: symbols.reduce(
              (total, symbol) => total + valued(lots.filter((lot) => lot.symbol === symbol), prices).unrealised,
              zero
            ),
            costs: costsOf(own),
            trades: own.reduce((total, row) => total + row.trades, 0)
          })
        }).sort((a, b) => {
          const difference = b.realised + b.unrealised - (a.realised + a.unrealised)
          return difference === zero ? 0 : difference > zero ? 1 : -1
        })

        const [flagged] = yield* db.select({ count: count() }).from(ledgerAdjustments).where(and(
          eq(ledgerAdjustments.userId, userId as `user_${string}`),
          ne(ledgerAdjustments.reason, "opening")
        )).pipe(Effect.orDie)
        const live = stocks.reduce((total, line) => total + line.unrealised, zero)

        return new PortfolioPerformance({
          realised: stocks.reduce((total, line) => total + line.realised, zero),
          unrealised: live,
          cost: Usdc.make(stocks.reduce((total, line) => total + line.cost, zero)),
          value: Usdc.make(stocks.reduce((total, line) => total + line.value, zero)),
          costs: costsOf(rows),
          trades: rows.reduce((total, row) => total + row.trades, 0),
          flagged: flagged?.count ?? 0,
          series: yield* chartOf(rows, live),
          stocks: stocks.filter((line) => line.shares > zero || line.realised !== zero),
          agents: agentLines
        })
      })

      const stock = Effect.fn("Performance.stock")(function*(userId: UserId, symbol: StockSymbol) {
        const lots = yield* ledger.openLots(userId, symbol)
        const rows = yield* dailyOf(userId, eq(pnlDaily.symbol, symbol))
        const position = valued(lots, yield* market.prices)

        return new StockPerformance({
          symbol,
          ...position,
          realised: rows.reduce((total, row) => total + row.realised, zero),
          costs: costsOf(rows),
          trades: rows.reduce((total, row) => total + row.trades, 0),
          lots,
          series: yield* chartOf(rows, position.unrealised)
        })
      })

      const agent = Effect.fn("Performance.agent")(function*(owner: Owner, agentId: AgentId) {
        const user = owner.id as `user_${string}`
        const id = agentId as `agent_${string}`
        const [row] = yield* db.select({ id: agents.id }).from(agents)
          .where(and(eq(agents.id, id), eq(agents.userId, user))).pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "agent", id: agentId })

        const prices = yield* market.prices
        const lots = (yield* ledger.openLots(owner.id)).filter((lot) => lot.agentId === agentId)
        const rows = yield* dailyOf(owner.id, eq(pnlDaily.agentId, id))
        const live = [...new Set(lots.map((lot) => lot.symbol))]
          .reduce(
            (total, symbol) => total + valued(lots.filter((lot) => lot.symbol === symbol), prices).unrealised,
            zero
          )

        const traded = yield* db.select({ side: trades.side, usdc: sum(trades.usdc) }).from(trades)
          .where(and(eq(trades.agentId, id), eq(trades.status, "filled"))).groupBy(trades.side).pipe(Effect.orDie)
        const decided = yield* db.select({
          status: intents.status,
          policy: sql<string | null>`${intents.decision}->>'policy'`
        })
          .from(intents).where(and(eq(intents.agentId, id), isNotNull(intents.decision))).pipe(Effect.orDie)
        const blocked = decided.filter((intent) => intent.status === "blocked")
        const policies = [...new Set(blocked.flatMap((intent) => (intent.policy === null ? [] : [intent.policy])))]

        const drift = yield* db.select().from(driftHistory).where(and(
          eq(driftHistory.agentId, id),
          gte(driftHistory.at, DateTime.subtract(yield* DateTime.now, DRIFT_KEPT))
        )).orderBy(asc(driftHistory.at)).pipe(Effect.orDie)

        return new AgentPerformance({
          agentId,
          realised: rows.reduce((total, row) => total + row.realised, zero),
          unrealised: live,
          bought: Usdc.make(BigInt(traded.find((side) => side.side === "buy")?.usdc ?? 0)),
          sold: Usdc.make(BigInt(traded.find((side) => side.side === "sell")?.usdc ?? 0)),
          costs: costsOf(rows),
          trades: rows.reduce((total, row) => total + row.trades, 0),
          decided: decided.length,
          blocked: blocked.length,
          blockedBy: policies
            .map((policy) =>
              new BlockedBy({
                policy: policy as PolicyId,
                count: blocked.filter((intent) => intent.policy === policy).length
              })
            )
            .sort((a, b) => b.count - a.count),
          series: yield* chartOf(rows, live),
          drift: drift.length === 0 ? null : drift.map((point) => new DriftPoint(point))
        })
      })

      const automation = Effect.fn("Performance.automation")(function*(owner: Owner, automationId: AutomationId) {
        const id = automationId as `automation_${string}`
        const [row] = yield* db.select({ id: automations.id }).from(automations)
          .where(and(eq(automations.id, id), eq(automations.userId, owner.id as `user_${string}`))).pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "automation", id: automationId })

        const runs = yield* db.select({
          id: automationRuns.id,
          outcome: automationRuns.outcome,
          firedAt: automationRuns.firedAt
        })
          .from(automationRuns).where(and(eq(automationRuns.automationId, id), ne(automationRuns.outcome, "running")))
          .orderBy(asc(automationRuns.firedAt)).pipe(Effect.orDie)
        const filled = runs.length === 0 ? [] : yield* db.select({
          id: trades.id,
          side: trades.side,
          usdc: trades.usdc,
          fee: trades.fee,
          slippage: trades.slippage,
          gasWei: trades.gasWei
        }).from(trades).innerJoin(intents, eq(intents.id, trades.intentId)).where(and(
          eq(intents.source, "automation"),
          inArray(intents.sourceId, runs.map((run) => run.id)),
          eq(trades.status, "filled")
        )).pipe(Effect.orDie)
        const closed = filled.length === 0 ? [] : yield* db.select({ realised: lotClosings.realised }).from(lotClosings)
          .where(inArray(lotClosings.tradeId, filled.map((trade) => trade.id))).pipe(Effect.orDie)

        const proposed = runs.length === 0 ? [] : yield* db.select({
          sourceId: intents.sourceId,
          status: intents.status,
          decision: intents.decision
        }).from(intents).where(and(
          eq(intents.source, "automation"),
          inArray(intents.sourceId, runs.map((run) => run.id))
        )).pipe(Effect.orDie)
        const results = runs.map((run) =>
          runResultOf(
            run.outcome === "running" ? "proposed" : run.outcome,
            proposed.filter((intent) => intent.sourceId === run.id)
          ).result
        )
        const outcomes = RunResult.literals
          .map((result) => new RunCount({ result, count: results.filter((each) => each === result).length }))
          .filter((row) => row.count > 0)

        return new AutomationPerformance({
          automationId,
          runs: runs.length,
          outcomes,
          trades: filled.length,
          bought: Usdc.make(filled.filter((t) => t.side === "buy").reduce((total, t) => total + t.usdc, zero)),
          sold: Usdc.make(filled.filter((t) => t.side === "sell").reduce((total, t) => total + t.usdc, zero)),
          realised: closed.reduce((total, closing) => total + closing.realised, zero),
          costs: new Costs({
            fees: filled.reduce((total, t) => total + (t.fee ?? zero), zero),
            slippage: filled.reduce((total, t) => total + (t.slippage ?? zero), zero),
            gasWei: filled.reduce((total, t) => total + (t.gasWei ?? zero), zero)
          }),
          lastRunAt: runs.at(-1)?.firedAt ?? null
        })
      })

      const recordDrift = Effect.fn("Performance.recordDrift")(function*(point: {
        readonly agentId: AgentId
        readonly userId: UserId
        readonly driftBps: number
        readonly triggerBps: number
      }) {
        const now = yield* DateTime.now
        yield* db.insert(driftHistory).values({
          agentId: point.agentId as `agent_${string}`,
          userId: point.userId as `user_${string}`,
          at: now,
          driftBps: point.driftBps,
          triggerBps: point.triggerBps
        }).onConflictDoNothing().pipe(Effect.orDie)
        yield* db.delete(driftHistory).where(and(
          eq(driftHistory.agentId, point.agentId as `agent_${string}`),
          lt(driftHistory.at, DateTime.subtract(now, DRIFT_KEPT))
        )).pipe(Effect.orDie)
      })

      return Performance.of({ portfolio, stock, agent, automation, recordDrift })
    })
  )
}
