import type { UserId } from "@bluechip/domain/Ids"
import { quietUntil } from "@bluechip/domain/notifications/QuietHours"
import { eq } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"
import { Database } from "../../platform/db/Database.ts"
import { measuredWorkflow } from "../../platform/engine/Measured.ts"
import {
  count,
  NotificationsDelay,
  NotificationsDelivered,
  NotifierErrors,
  record as recordMetric,
  secondsSince,
  WorkflowRetries
} from "../../platform/telemetry/Metrics.ts"
import { users } from "../accounts/tables.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { DeliverNotification } from "./DeliverNotification.ts"
import { toNotification } from "./Notifications.ts"
import { Notifiers } from "./Notifiers.ts"
import { notificationDeliveries, notifications, notificationSettings } from "./tables.ts"

// A platform that refuses for now (a timeout, a rate limit) gets three more tries over about a minute.
const retries = Schedule.exponential("4 seconds", 2)

/**
 * Notification deliveries: when one may go out (after the user's quiet hours), and sending it through its channel's
 * notifier, retried while the platform's refusal can pass, then saved as sent, skipped or failed with why.
 */
export class Deliveries extends Context.Service<Deliveries, {
  /** When the delivery may go out: `null` for now. */
  readonly quietUntil: (deliveryId: string) => Effect.Effect<DateTime.Utc | null>
  /** Sends a pending delivery; one already sent, skipped or failed stays as it is. */
  readonly send: (deliveryId: string) => Effect.Effect<void>
}>()("@bluechip/server/Deliveries") {
  static readonly layer = Layer.effect(
    Deliveries,
    Effect.gen(function*() {
      const db = yield* Database
      const notifiers = yield* Notifiers
      const analytics = yield* Analytics

      const find = Effect.fnUntraced(function*(deliveryId: string) {
        const [found] = yield* db.select({ delivery: notificationDeliveries, notification: notifications })
          .from(notificationDeliveries)
          .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
          .where(eq(notificationDeliveries.id, deliveryId as `delivery_${string}`)).pipe(Effect.orDie)
        return found
      })

      const save = (deliveryId: string, status: "sent" | "skipped" | "failed", error: string | null) =>
        Effect.flatMap(DateTime.now, (at) =>
          db.update(notificationDeliveries).set({ status, error, at })
            .where(eq(notificationDeliveries.id, deliveryId as `delivery_${string}`)).pipe(Effect.orDie))

      const quietUntilOf = Effect.fn("Deliveries.quietUntil")(function*(deliveryId: string) {
        const found = yield* find(deliveryId)
        if (found === undefined) return null
        const [owner] = yield* db.select({ quietHours: notificationSettings.quietHours, timeZone: users.timeZone })
          .from(users)
          .leftJoin(notificationSettings, eq(notificationSettings.userId, users.id))
          .where(eq(users.id, found.notification.userId)).pipe(Effect.orDie)
        return quietUntil(
          owner?.quietHours ?? null,
          found.notification.severity,
          yield* DateTime.now,
          owner?.timeZone ?? "UTC"
        ) ?? null
      })

      const send = Effect.fn("Deliveries.send")(function*(deliveryId: string) {
        const found = yield* find(deliveryId)
        if (found === undefined || found.delivery.status !== "pending") return

        const { channel } = found.delivery
        const kind = found.notification.kind
        const outcome = yield* notifiers.send(
          channel,
          found.notification.userId as UserId,
          toNotification(found.notification)
        )
          .pipe(
            Effect.tapError((error) =>
              Effect.andThen(
                count(NotifierErrors, { channel, retryable: String(error.retryable) }),
                error.retryable ?
                  Effect.andThen(
                    count(NotificationsDelivered, { channel, kind, outcome: "retried" }),
                    count(WorkflowRetries, { workflow: "DeliverNotification", activity: "send" })
                  ) :
                  Effect.void
              )
            ),
            Effect.retry({ schedule: retries, times: 3, while: (error) => error.retryable }),
            Effect.matchEffect({
              onSuccess: (outcome) => Effect.as(save(deliveryId, outcome, null), outcome),
              onFailure: (error) =>
                Effect.andThen(
                  Effect.logWarning(`A ${error.channel} delivery failed: ${error.reason}`),
                  Effect.as(save(deliveryId, "failed", error.reason), "failed" as const)
                )
            })
          )
        yield* count(NotificationsDelivered, { channel, kind, outcome })
        if (outcome === "sent") {
          yield* recordMetric(NotificationsDelay, yield* secondsSince(found.notification.createdAt), { channel })
          yield* analytics.capture(found.notification.userId as UserId, {
            _tag: "notification_sent",
            kind,
            channel,
            severity: found.notification.severity
          }, { id: deliveryId })
        }
      })

      return Deliveries.of({ quietUntil: quietUntilOf, send })
    })
  )
}

/** The delivery workflow's handler: wait out quiet hours, then send once. */
export const DeliverNotificationLive = DeliverNotification.toLayer(
  Effect.fnUntraced(function*({ deliveryId }) {
    const deliveries = yield* Deliveries
    const until = yield* Activity.make({
      name: "quietUntil",
      success: Schema.NullOr(Schema.DateTimeUtc),
      execute: deliveries.quietUntil(deliveryId)
    })
    if (until !== null) {
      const left = DateTime.distance(yield* DateTime.now, until)
      yield* DurableClock.sleep({ name: "quietHours", duration: Duration.max(left, Duration.zero) })
    }
    yield* Activity.make({ name: "send", execute: deliveries.send(deliveryId) })
  }, measuredWorkflow("DeliverNotification"))
)
