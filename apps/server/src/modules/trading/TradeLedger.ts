import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { fillOf } from "@bluechip/chain/market/Swaps"
import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, TradeId, TxHash, UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween, Price, priceOf, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Trade, transition } from "@bluechip/domain/trading/Trade"
import { and, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Result from "effect/Result"
import type { Hex } from "viem"
import { Database } from "../../platform/db/Database.ts"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import {
  count,
  record as recordMetric,
  sourceOf,
  TradesFailed,
  TradesFees,
  TradesFilled,
  TradesSize,
  TradesSlippage,
  TradesValue,
  usd
} from "../../platform/telemetry/Metrics.ts"
import { intents } from "../intents/tables.ts"
import { Ledger } from "../ledger/Ledger.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import type { Receipt } from "../signing/OwnerOperations.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { trades } from "./tables.ts"

export type TradeRow = typeof trades.$inferSelect

/** A trade as the API returns it. */
export const toTrade = (row: TradeRow) =>
  new Trade({
    id: row.id as TradeId,
    agentId: row.agentId as AgentId | null,
    symbol: row.symbol as StockSymbol,
    side: row.side,
    status: row.status,
    usdc: Usdc.make(row.usdc),
    shares: Shares.make(row.shares),
    price: Price.make(row.price),
    reference: Price.make(row.reference),
    referenceStatus: row.referenceStatus,
    gapBps: row.gapBps,
    txHash: row.txHash as TxHash | null,
    createdAt: row.createdAt,
    settledAt: row.settledAt
  })

/** Every trade sent, by its owner or an agent: recorded when it is sent, settled from its receipt. */
export class TradeLedger extends Context.Service<TradeLedger, {
  /** Records a trade just sent. */
  readonly record: (trade: typeof trades.$inferInsert) => Effect.Effect<TradeRow>
  /** The trade with this id. */
  readonly row: (id: string) => Effect.Effect<TradeRow | undefined>
  /** The owner's trade with this id. */
  readonly find: (owner: Owner, id: TradeId) => Effect.Effect<Trade, NotFound>
  /**
   * Records how a sent trade ended, from its receipt (`undefined` when none came): filled with exactly what moved
   * (read from the logs), or failed (the money stays); a fill goes to the ledger. Then refreshes the account's
   * balances and tells its owner.
   * Returns the trade as saved, or `undefined` when it had already ended.
   */
  readonly settle: (row: TradeRow, account: Hex, receipt: Receipt | undefined) => Effect.Effect<TradeRow | undefined>
}>()("@bluechip/server/TradeLedger") {
  static readonly layer = Layer.effect(
    TradeLedger,
    Effect.gen(function*() {
      const db = yield* Database
      const live = yield* LiveEvents
      const balances = yield* AccountBalances
      const ledger = yield* Ledger
      const deployment = yield* ChainDeployment

      const record = Effect.fn("TradeLedger.record")(function*(trade: typeof trades.$inferInsert) {
        const [row] = yield* db.insert(trades).values(trade).returning().pipe(Effect.orDie)
        return row!
      })

      const row = Effect.fn("TradeLedger.row")(function*(id: string) {
        const [row] = yield* db.select().from(trades).where(eq(trades.id, id as `trade_${string}`)).pipe(Effect.orDie)
        return row
      })

      const find = Effect.fn("TradeLedger.find")(function*(owner: Owner, id: TradeId) {
        const [row] = yield* db.select().from(trades)
          .where(and(eq(trades.id, id as `trade_${string}`), eq(trades.userId, owner.id as `user_${string}`)))
          .pipe(Effect.orDie)
        if (row === undefined) return yield* new NotFound({ resource: "trade", id })
        return toTrade(row)
      })

      // The trades' metrics, once a trade ended: its value and costs (the ledger has recorded them by now) when it
      // filled, why not otherwise.
      const measure = Effect.fnUntraced(function*(trade: TradeRow, receipt: Receipt | undefined) {
        const [intent] = trade.intentId === null ?
          [] :
          yield* db.select({ source: intents.source, executor: intents.executor })
            .from(intents).where(eq(intents.id, trade.intentId)).pipe(Effect.orDie)
        const executor = intent?.executor ?? (trade.agentId === null ? "owner" : "agent")
        const source = sourceOf(intent?.source ?? "owner", executor)
        yield* Effect.annotateCurrentSpan({
          "trade.side": trade.side,
          "stock.symbol": trade.symbol,
          "intent.source": source
        })

        if (trade.status !== "filled") {
          return yield* count(TradesFailed, { reason: receipt === undefined ? "bundler" : "reverted", source })
        }
        const dollars = usd(trade.usdc)
        yield* Effect.annotateCurrentSpan("trade.usd", dollars)
        const traded = { side: trade.side, source, executor, symbol: trade.symbol }
        yield* count(TradesFilled, traded)
        yield* recordMetric(TradesValue, dollars, traded)
        yield* recordMetric(TradesSize, dollars, { side: trade.side, source })
        yield* recordMetric(TradesSlippage, trade.gapBps, { side: trade.side, symbol: trade.symbol })

        const costs = yield* row(trade.id)
        const gasPaidBy = costs?.gasPaidBy ?? "unknown"
        if (costs?.fee != null) {
          yield* recordMetric(TradesFees, usd(costs.fee), { kind: "pool", gas_paid_by: gasPaidBy })
        }
        if (costs?.slippage != null) {
          yield* recordMetric(TradesFees, usd(costs.slippage), { kind: "slippage", gas_paid_by: gasPaidBy })
        }
      })

      const settle = Effect.fn("TradeLedger.settle")(
        function*(row: TradeRow, account: Hex, receipt: Receipt | undefined) {
          yield* Effect.annotateCurrentSpan({ "trade.id": row.id, "user.id": row.userId })
          const stock = deployment.stocks.find((candidate) => candidate.symbol === row.symbol)!
          const fill = receipt?.success === true
            ? fillOf(deployment, receipt.logs, { stock, side: row.side }, account)
            : undefined
          const next = transition(row.status, { _tag: fill === undefined ? "Failed" : "Filled" })
          if (Result.isFailure(next)) {
            yield* Effect.logWarning(`Trade ${row.id}: ${next.failure}`)
            return undefined
          }

          // What a fill moved: exact USDC and shares, the price they make and its gap to Chainlink.
          const usdc = fill === undefined ? undefined : (row.side === "buy" ? fill.amountIn : fill.amountOut) as Usdc
          const shares = fill === undefined
            ? undefined
            : (row.side === "buy" ? fill.amountOut : fill.amountIn) as Shares
          const filled = usdc === undefined || shares === undefined ? {} : {
            usdc,
            shares,
            price: priceOf(usdc, shares),
            // Paying above the reference is worse for a buyer; receiving below it is worse for a seller.
            gapBps: row.side === "buy"
              ? bpsBetween(priceOf(usdc, shares), row.reference)
              : bpsBetween(row.reference, priceOf(usdc, shares))
          }
          const [updated] = yield* db.update(trades).set({
            status: next.success,
            txHash: receipt?.txHash ?? null,
            settledAt: yield* DateTime.now,
            ...filled
          }).where(eq(trades.id, row.id)).returning().pipe(Effect.orDie)
          // The ledger catches up on its next repair if this is cut off; the trade's own record never waits on it.
          yield* ledger.recordFill(updated!, receipt?.gas).pipe(
            Effect.catchCause((cause) => Effect.logWarning(`Trade ${row.id}: the ledger couldn't record it`, cause))
          )

          yield* measure(updated!, receipt)

          // Fresh balances before the events, so a client that refetches on them sees the new holdings.
          yield* balances.invalidate(account)
          yield* live.publish(LiveEvent.cases.TradeUpdated.make({ trade: toTrade(updated!) }), row.userId as UserId)
          yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), row.userId as UserId)
          return updated!
        }
      )

      return TradeLedger.of({ record, row, find, settle })
    })
  )
}
