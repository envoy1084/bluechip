import type { Address, TransferId, TxHash, UserId } from "@bluechip/domain/Ids"
import { type Asset, Transfer } from "@bluechip/domain/portfolio/Transfer"
import { and, desc, eq, lt, or } from "drizzle-orm"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Database } from "../db/Database.ts"
import { transfers } from "../db/schema/funding.ts"

type TransferRow = typeof transfers.$inferSelect

export const toTransfer = (row: TransferRow) =>
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

// Page tokens are the last row's time and id, so a page never repeats or skips a row while new ones arrive.
const encodeToken = (row: TransferRow) => `${DateTime.toEpochMillis(row.createdAt)}.${row.id}`
const decodeToken = (token: string) => {
  const [millis, id] = token.split(".")
  const at = DateTime.make(Number(millis))
  return Option.isSome(at) && id !== undefined ? { at: at.value, id: id as `transfer_${string}` } : undefined
}

/** The user's transfers, newest first. */
export const listTransfers = Effect.fn("Transfers.list")(
  function*(userId: UserId, page: { readonly pageSize?: number; readonly pageToken?: string }) {
    const db = yield* Database
    const size = page.pageSize ?? 20
    const after = page.pageToken === undefined ? undefined : decodeToken(page.pageToken)
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
    return { items: items.map(toTransfer), nextPageToken: rows.length > size ? encodeToken(items.at(-1)!) : null }
  }
)
