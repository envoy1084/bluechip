import { NotFound } from "@bluechip/domain/Errors"
import type { PushSubscriptionId, UserId } from "@bluechip/domain/Ids"
import { type NewPushSubscription, PushDevice } from "@bluechip/domain/push/Push"
import { and, asc, eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { count, PushSubscriptions as PushSubscriptionsMetric } from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { pushSubscriptions } from "./tables.ts"

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect

const toDevice = (row: PushSubscriptionRow) =>
  new PushDevice({
    id: row.id as PushSubscriptionId,
    device: row.device,
    endpoint: row.endpoint,
    createdAt: row.createdAt
  })

/**
 * The devices that opted in to push: one subscription per browser, by its endpoint (subscribing again, or from
 * another account, moves it), removed when you opt out or the push service says it is gone.
 */
export class PushSubscriptions extends Context.Service<PushSubscriptions, {
  readonly devices: (userId: UserId) => Effect.Effect<ReadonlyArray<PushDevice>>
  readonly rows: (userId: UserId) => Effect.Effect<ReadonlyArray<PushSubscriptionRow>>
  readonly subscribe: (userId: UserId, subscription: NewPushSubscription) => Effect.Effect<PushDevice>
  readonly unsubscribe: (userId: UserId, id: string) => Effect.Effect<void, NotFound>
  /** Forgets a subscription the push service no longer knows. */
  readonly forget: (id: string) => Effect.Effect<void>
}>()("@bluechip/server/PushSubscriptions") {
  static readonly layer = Layer.effect(
    PushSubscriptions,
    Effect.gen(function*() {
      const db = yield* Database
      const analytics = yield* Analytics

      const rows = Effect.fn("PushSubscriptions.rows")(function*(userId: UserId) {
        return yield* db.select().from(pushSubscriptions)
          .where(eq(pushSubscriptions.userId, userId as `user_${string}`))
          .orderBy(asc(pushSubscriptions.createdAt)).pipe(Effect.orDie)
      })

      const subscribe = Effect.fn("PushSubscriptions.subscribe")(
        function*(userId: UserId, subscription: NewPushSubscription) {
          const values = {
            userId: userId as `user_${string}`,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            device: subscription.device,
            createdAt: yield* DateTime.now
          }
          const [row] = yield* db.insert(pushSubscriptions).values({
            id: typeid("pushsub").toString() as `pushsub_${string}`,
            endpoint: subscription.endpoint,
            ...values
          }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values }).returning().pipe(Effect.orDie)
          yield* count(PushSubscriptionsMetric, { change: "added" })
          yield* analytics.capture(userId, { _tag: "push_enabled" }, {
            id: row!.id,
            at: row!.createdAt,
            set: { push_enabled: true }
          })
          return toDevice(row!)
        }
      )

      const unsubscribe = Effect.fn("PushSubscriptions.unsubscribe")(function*(userId: UserId, id: string) {
        const removed = yield* db.delete(pushSubscriptions).where(and(
          eq(pushSubscriptions.id, id as `pushsub_${string}`),
          eq(pushSubscriptions.userId, userId as `user_${string}`)
        )).returning().pipe(Effect.orDie)
        if (removed.length === 0) return yield* new NotFound({ resource: "pushDevice", id })
        yield* count(PushSubscriptionsMetric, { change: "removed" })
        if ((yield* rows(userId)).length === 0) {
          yield* analytics.capture(userId, { _tag: "push_disabled" }, {
            id: `${id}:removed`,
            set: { push_enabled: false }
          })
        }
      })

      // A device its push service no longer knows (404, 410).
      const forget = (id: string) =>
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id as `pushsub_${string}`)).pipe(
          Effect.orDie,
          Effect.andThen(count(PushSubscriptionsMetric, { change: "expired_410" }))
        )

      return PushSubscriptions.of({
        devices: (userId) => Effect.map(rows(userId), (found) => found.map(toDevice)),
        rows,
        subscribe,
        unsubscribe,
        forget
      })
    })
  )
}
