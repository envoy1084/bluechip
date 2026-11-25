import { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { UserId } from "@bluechip/domain/Ids"
import { and, desc, eq, gte, lt, or } from "drizzle-orm"
import type { PgColumn } from "drizzle-orm/pg-core"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { Database } from "../../platform/db/Database.ts"
import { transfers } from "../funding/tables.ts"
import { toTransfer } from "../funding/Transfers.ts"
import { trades } from "../trading/tables.ts"
import { toTrade } from "../trading/TradeLedger.ts"

const PERIOD_DAYS = { "7d": 7, "30d": 30 } as const

/** What the account did: its trades and withdrawals, in one timeline. */
export class Activity extends Context.Service<Activity, {
  /** The user's trades and withdrawals, newest first, by kind and period, a page at a time. */
  readonly list: (userId: UserId, query: {
    readonly kind?: "all" | "trades" | "cash"
    readonly period?: "7d" | "30d" | "all"
    readonly pageSize?: number
    readonly pageToken?: string
  }) => Effect.Effect<{ readonly items: ReadonlyArray<ActivityItem>; readonly nextPageToken: string | null }>
}>()("@bluechip/server/Activity") {
  static readonly layer = Layer.effect(
    Activity,
    Effect.gen(function*() {
      const db = yield* Database

      const list = Effect.fn("Activity.list")(function*(
        userId: UserId,
        query: {
          readonly kind?: "all" | "trades" | "cash"
          readonly period?: "7d" | "30d" | "all"
          readonly pageSize?: number
          readonly pageToken?: string
        }
      ) {
        const size = query.pageSize ?? 20
        const kind = query.kind ?? "all"
        const period = query.period ?? "all"
        const since = period === "all"
          ? undefined
          : DateTime.subtract(yield* DateTime.now, { days: PERIOD_DAYS[period] })

        // Page tokens are the last item's time and id, so a page never repeats or skips one while new ones arrive.
        const [millis, id] = query.pageToken?.split(".") ?? []
        const at = DateTime.make(Number(millis))
        const after = Option.isSome(at) && id !== undefined ? { at: at.value, id } : undefined

        // Rows of a table before the cursor and inside the period.
        const window = (columns: { readonly userId: PgColumn; readonly createdAt: PgColumn; readonly id: PgColumn }) =>
          and(
            eq(columns.userId, userId),
            since === undefined ? undefined : gte(columns.createdAt, since),
            after === undefined ? undefined : or(
              lt(columns.createdAt, after.at),
              and(eq(columns.createdAt, after.at), lt(columns.id, after.id))
            )
          )

        const tradeRows = kind === "cash" ? [] : yield* db.select().from(trades)
          .where(window(trades))
          .orderBy(desc(trades.createdAt), desc(trades.id)).limit(size + 1).pipe(Effect.orDie)
        const transferRows = kind === "trades" ? [] : yield* db.select().from(transfers)
          .where(window(transfers))
          .orderBy(desc(transfers.createdAt), desc(transfers.id)).limit(size + 1).pipe(Effect.orDie)

        const merged = [
          ...tradeRows.map((row) => ({
            at: row.createdAt,
            id: row.id as string,
            item: ActivityItem.cases.Trade.make({ trade: toTrade(row) })
          })),
          ...transferRows.map((row) => ({
            at: row.createdAt,
            id: row.id as string,
            item: ActivityItem.cases.Withdrawal.make({ transfer: toTransfer(row) })
          }))
        ].sort((a, b) =>
          DateTime.Equivalence(a.at, b.at) ? b.id.localeCompare(a.id) : DateTime.isGreaterThan(a.at, b.at) ? -1 : 1
        )

        const page = merged.slice(0, size)
        const last = page.at(-1)
        return {
          items: page.map((entry) => entry.item),
          nextPageToken: merged.length > size ? `${DateTime.toEpochMillis(last!.at)}.${last!.id}` : null
        }
      })

      return Activity.of({ list })
    })
  )
}
