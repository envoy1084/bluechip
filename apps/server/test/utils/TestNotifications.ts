// A notification's deliveries, followed to their end: each delivery's workflow is executed again by its id (it is
// keyed by the delivery, so this waits for the run already going) and its row read back.
import type { NotificationId } from "@bluechip/domain/Ids"
import { eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { DeliverNotification } from "../../src/modules/notifications/DeliverNotification.ts"
import { notificationDeliveries } from "../../src/modules/notifications/tables.ts"
import { Database } from "../../src/platform/db/Database.ts"
import { TestServer } from "./TestServer.ts"

/** Where a delivery ended: its channel, status and why it failed. */
export interface DeliveryEnd {
  readonly channel: "push" | "telegram"
  readonly status: "pending" | "sent" | "skipped" | "failed"
  readonly error: string | null
}

export class TestNotifications extends Context.Service<TestNotifications, {
  /** Waits for every delivery of a notification to end, and returns them by channel. */
  readonly delivered: (id: NotificationId) => Effect.Effect<ReadonlyArray<DeliveryEnd>>
}>()("@bluechip/server/test/TestNotifications") {
  static readonly layerNoDeps = Layer.effect(
    TestNotifications,
    Effect.gen(function*() {
      const db = yield* Database
      const engine = yield* WorkflowEngine.WorkflowEngine

      const rows = (id: NotificationId) =>
        db.select().from(notificationDeliveries)
          .where(eq(notificationDeliveries.notificationId, id as `notification_${string}`))
          .orderBy(notificationDeliveries.channel).pipe(Effect.orDie)

      return {
        delivered: Effect.fnUntraced(function*(id: NotificationId) {
          for (const row of yield* rows(id)) {
            yield* DeliverNotification.execute({ deliveryId: row.id }).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
              Effect.orDie
            )
          }
          return (yield* rows(id)).map(({ channel, error, status }) => ({ channel, status, error }))
        })
      }
    })
  )

  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestServer))
}
