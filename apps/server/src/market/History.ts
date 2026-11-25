import { type HistoryRange, PricePoint, type StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { Database } from "../db/Database.ts"
import { pricePoints } from "../db/schema/market.ts"

/** A feed answer to keep. */
export interface PriceRecord {
  readonly symbol: StockSymbol
  readonly at: DateTime.Utc
  readonly price: bigint
}

const RANGE_DAYS: Readonly<Record<Exclude<HistoryRange, "ALL">, number>> = { "1D": 1, "1W": 7, "1M": 30, "3M": 90 }

// Enough points for a smooth chart at any width; more only costs bytes.
const MAX_POINTS = 300

/** Stores feed answers; an answer already stored (same stock and time) is skipped, so snapshots can overlap. */
export const recordPrices = Effect.fn("History.record")(function*(records: ReadonlyArray<PriceRecord>) {
  if (records.length === 0) return
  const db = yield* Database
  yield* db.insert(pricePoints).values(records.map((record) => ({ ...record }))).onConflictDoNothing().pipe(
    Effect.orDie
  )
})

/**
 * A stock's prices over `range` up to `now`, oldest first: the price in force at the range's start, then every
 * answer since, thinned to at most 300 points by keeping the last answer of each time slice.
 */
export const readHistory = Effect.fn("History.read")(
  function*(symbol: StockSymbol, range: HistoryRange, now: DateTime.Utc) {
    const db = yield* Database
    const since = range === "ALL" ? DateTime.makeUnsafe(0) : DateTime.subtract(now, { days: RANGE_DAYS[range] })
    const [opening] = yield* db.select().from(pricePoints)
      .where(and(eq(pricePoints.symbol, symbol), lt(pricePoints.at, since)))
      .orderBy(desc(pricePoints.at)).limit(1).pipe(Effect.orDie)
    const rows = yield* db.select().from(pricePoints)
      .where(and(eq(pricePoints.symbol, symbol), gte(pricePoints.at, since), lte(pricePoints.at, now)))
      .orderBy(asc(pricePoints.at)).pipe(Effect.orDie)
    const points = [...(opening === undefined || range === "ALL" ? [] : [{ ...opening, at: since }]), ...rows]
    if (points.length <= MAX_POINTS) return points.map(toPoint)
    const start = DateTime.toEpochMillis(points[0]!.at)
    const slice = (DateTime.toEpochMillis(now) - start) / MAX_POINTS
    const thinned = new Map<number, (typeof points)[number]>()
    for (const point of points) thinned.set(Math.floor((DateTime.toEpochMillis(point.at) - start) / slice), point)
    return [...thinned.values()].map(toPoint)
  }
)

const toPoint = (row: { readonly at: DateTime.Utc; readonly price: bigint }) =>
  new PricePoint({ at: row.at, price: Price.make(row.price) })

/** Each stock's price as it stood at `at` (its last answer at or before then), for daily change. */
export const pricesAt = Effect.fn("History.pricesAt")(function*(at: DateTime.Utc) {
  const db = yield* Database
  const rows = yield* db.selectDistinctOn([pricePoints.symbol]).from(pricePoints)
    .where(lte(pricePoints.at, at))
    .orderBy(pricePoints.symbol, desc(pricePoints.at)).pipe(Effect.orDie)
  return new Map(rows.map((row) => [row.symbol, row.price]))
})
