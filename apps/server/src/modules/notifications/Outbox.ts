import type { LiveEvent } from "@bluechip/domain/Events"
import type { UserId } from "@bluechip/domain/Ids"
import { and, asc, eq, inArray, isNull, lt, or } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { notificationOutbox } from "./tables.ts"

export type OutboxRow = typeof notificationOutbox.$inferSelect

// How long a claimed row is left to the process that claimed it before another takes it.
const CLAIM_MINUTES = 1

/**
 * The notifications' outbox: producers write the event that tells a change inside the transaction that makes the
 * change (a query on `Database` inside `db.transaction` joins it), and the fan-out claims, handles and deletes them.
 */
export class NotificationOutbox extends Context.Service<NotificationOutbox, {
  /** Writes `event` for `userId`; call it inside the transaction of the change it tells. */
  readonly write: (event: LiveEvent, userId: UserId) => Effect.Effect<void>
  /**
   * Claims up to 100 rows nobody holds, oldest first: one user's, or everyone's written before `before` (a sweep
   * leaves fresh rows to the process that wrote them).
   */
  readonly claim: (options: {
    readonly userId?: UserId | undefined
    readonly before?: DateTime.Utc | undefined
  }) => Effect.Effect<ReadonlyArray<OutboxRow>>
  /** Deletes a handled row. */
  readonly done: (id: OutboxRow["id"]) => Effect.Effect<void>
}>()("@bluechip/server/NotificationOutbox") {
  static readonly layer = Layer.effect(
    NotificationOutbox,
    Effect.gen(function*() {
      const db = yield* Database

      const write = Effect.fn("NotificationOutbox.write")(function*(event: LiveEvent, userId: UserId) {
        yield* db.insert(notificationOutbox).values({
          id: typeid("outbox").toString() as `outbox_${string}`,
          userId: userId as `user_${string}`,
          event,
          createdAt: yield* DateTime.now,
          claimedAt: null
        }).pipe(Effect.orDie)
      })

      const claim = Effect.fn("NotificationOutbox.claim")(function*(options: {
        readonly userId?: UserId | undefined
        readonly before?: DateTime.Utc | undefined
      }) {
        const now = yield* DateTime.now
        const free = db.select({ id: notificationOutbox.id }).from(notificationOutbox).where(and(
          options.userId === undefined ? undefined : eq(notificationOutbox.userId, options.userId as `user_${string}`),
          options.before === undefined ? undefined : lt(notificationOutbox.createdAt, options.before),
          or(
            isNull(notificationOutbox.claimedAt),
            lt(notificationOutbox.claimedAt, DateTime.subtract(now, { minutes: CLAIM_MINUTES }))
          )
        )).orderBy(asc(notificationOutbox.id)).limit(100).for("update", { skipLocked: true })

        const rows = yield* db.update(notificationOutbox).set({ claimedAt: now })
          .where(inArray(notificationOutbox.id, free)).returning().pipe(Effect.orDie)
        return rows.toSorted((a, b) => a.id.localeCompare(b.id))
      })

      const done = (id: OutboxRow["id"]) =>
        db.delete(notificationOutbox).where(eq(notificationOutbox.id, id)).pipe(Effect.orDie, Effect.asVoid)

      return NotificationOutbox.of({ write, claim, done })
    })
  )
}
