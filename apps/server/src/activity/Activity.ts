import { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { UserId } from "@bluechip/domain/Ids"
import { and, desc, eq, gte, lt, or, type SQL } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Database } from "../db/Database.ts"
import { transfers } from "../db/schema/funding.ts"
import { trades } from "../db/schema/trading.ts"
import { toTransfer } from "../funding/TransferRecords.ts"
import { toTrade } from "../trading/TradeRecords.ts"

const PERIOD_DAYS = { "7d": 7, "30d": 30 } as const

interface Cursor {
  readonly at: DateTime.Utc
  readonly id: string
}

// Page tokens are the last item's time and id, so a page never repeats or skips one while new ones arrive.
const encodeToken = (cursor: Cursor) => `${DateTime.toEpochMillis(cursor.at)}.${cursor.id}`
const decodeToken = (token: string): Cursor | undefined => {
  const [millis, id] = token.split(".")
  const at = DateTime.make(Number(millis))
  return Option.isSome(at) && id !== undefined ? { at: at.value, id } : undefined
}

/** Rows of a table before the cursor and inside the period, newest first. */
const window = (
  columns: { readonly userId: PgColumn; readonly createdAt: PgColumn; readonly id: PgColumn },
  userId: UserId,
  since: DateTime.Utc | undefined,
  after: Cursor | undefined
): SQL | undefined =>
  and(
    eq(columns.userId, userId),
    since === undefined ? undefined : gte(columns.createdAt, since),
    after === undefined ? undefined : or(
      lt(columns.createdAt, after.at),
      and(eq(columns.createdAt, after.at), lt(columns.id, after.id))
    )
  )

/** The user's trades and withdrawals, newest first, by kind and period, a page at a time. */
export const listActivity = Effect.fn("Activity.list")(function*(
  userId: UserId,
  query: {
    readonly kind?: "all" | "trades" | "cash"
    readonly period?: "7d" | "30d" | "all"
    readonly pageSize?: number
    readonly pageToken?: string
  }
) {
  const db = yield* Database
  const size = query.pageSize ?? 20
  const kind = query.kind ?? "all"
  const period = query.period ?? "all"
  const since = period === "all" ? undefined : DateTime.subtract(yield* DateTime.now, { days: PERIOD_DAYS[period] })
  const after = query.pageToken === undefined ? undefined : decodeToken(query.pageToken)

  const tradeRows = kind === "cash" ? [] : yield* db.select().from(trades)
    .where(window(trades, userId, since, after))
    .orderBy(desc(trades.createdAt), desc(trades.id)).limit(size + 1).pipe(Effect.orDie)
  const transferRows = kind === "trades" ? [] : yield* db.select().from(transfers)
    .where(window(transfers, userId, since, after))
    .orderBy(desc(transfers.createdAt), desc(transfers.id)).limit(size + 1).pipe(Effect.orDie)

  const merged = [
    ...tradeRows.map((row) => ({
      at: row.createdAt,
      id: row.id,
      item: ActivityItem.cases.Trade.make({ trade: toTrade(row) })
    })),
    ...transferRows.map((row) => ({
      at: row.createdAt,
      id: row.id,
      item: ActivityItem.cases.Withdrawal.make({ transfer: toTransfer(row) })
    }))
  ].sort((a, b) =>
    DateTime.Equivalence(a.at, b.at) ? b.id.localeCompare(a.id) : DateTime.isGreaterThan(a.at, b.at) ? -1 : 1
  )

  const page = merged.slice(0, size)
  return {
    items: page.map((entry) => entry.item),
    nextPageToken: merged.length > size ? encodeToken(page.at(-1)!) : null
  }
})
