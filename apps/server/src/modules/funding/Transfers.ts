import type { Address, TransferId, TxHash, UserId } from "@bluechip/domain/Ids"
import { type Asset, Transfer } from "@bluechip/domain/portfolio/Transfer"
import { and, desc, eq, lt, or } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { Database } from "../../platform/db/Database.ts"
import { transfers } from "./tables.ts"

/** A transfer as the API returns it. */
export const toTransfer = (row: typeof transfers.$inferSelect) =>
  new Transfer({
    id: row.id as TransferId,
    kind: row.kind,
    asset: row.asset as Asset,
    amount: row.amount,
    from: row.from as Address,
    to: row.to as Address,
    status: row.status,
    txHash: row.txHash as TxHash | null,
    createdAt: row.createdAt
  })

/** Money in and out of accounts. */
export class Transfers extends Context.Service<Transfers, {
  /** The user's transfers, newest first, a page at a time. */
  readonly list: (
    userId: UserId,
    page: { readonly pageSize?: number; readonly pageToken?: string }
  ) => Effect.Effect<{ readonly items: ReadonlyArray<Transfer>; readonly nextPageToken: string | null }>
}>()("@bluechip/server/Transfers") {
  static readonly layer = Layer.effect(
    Transfers,
    Effect.gen(function*() {
      const db = yield* Database

      const list = Effect.fn("Transfers.list")(
        function*(userId: UserId, page: { readonly pageSize?: number; readonly pageToken?: string }) {
          const size = page.pageSize ?? 20
          // Page tokens are the last row's time and id, so a page never repeats or skips a row while new ones arrive.
          const [millis, id] = page.pageToken?.split(".") ?? []
          const at = DateTime.make(Number(millis))
          const after = Option.isSome(at) && id !== undefined
            ? { at: at.value, id: id as `transfer_${string}` }
            : undefined

          const rows = yield* db.select().from(transfers)
            .where(and(
              eq(transfers.userId, userId as `user_${string}`),
              after === undefined ? undefined : or(
                lt(transfers.createdAt, after.at),
                and(eq(transfers.createdAt, after.at), lt(transfers.id, after.id))
              )
            ))
            .orderBy(desc(transfers.createdAt), desc(transfers.id))
            .limit(size + 1)
            .pipe(Effect.orDie)

          const items = rows.slice(0, size)
          const last = items.at(-1)
          return {
            items: items.map(toTransfer),
            nextPageToken: rows.length > size ? `${DateTime.toEpochMillis(last!.createdAt)}.${last!.id}` : null
          }
        }
      )

      return Transfers.of({ list })
    })
  )
}
