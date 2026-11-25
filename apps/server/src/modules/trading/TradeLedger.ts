import { stocks } from "@bluechip/chain/Contracts"
import { fillOf } from "@bluechip/chain/market/Swaps"
import { NotFound } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import type { TradeId, TxHash, UserId } from "@bluechip/domain/Ids"
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
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import type { Receipt } from "../signing/OwnerOperations.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { trades } from "./tables.ts"

export type TradeRow = typeof trades.$inferSelect

/** A trade as the API returns it. */
export const toTrade = (row: TradeRow) =>
  new Trade({
    id: row.id as TradeId,
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
   * (read from the logs), or failed (the money stays). Then refreshes the account's balances and tells its owner.
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

      const settle = Effect.fn("TradeLedger.settle")(
        function*(row: TradeRow, account: Hex, receipt: Receipt | undefined) {
          const stock = stocks.find((candidate) => candidate.symbol === row.symbol)!
          const fill = receipt?.success === true ? fillOf(receipt.logs, { stock, side: row.side }, account) : undefined
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
