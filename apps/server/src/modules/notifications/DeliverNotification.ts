import * as Schema from "effect/Schema"
import * as Workflow from "effect/workflow/Workflow"

/**
 * One notification's delivery on one channel, keyed by the delivery: it waits out quiet hours on a durable clock,
 * then sends with retries, so a restart neither drops it nor sends it twice once sent. Its handler is
 * `DeliverNotificationLive` (`Deliveries.ts`).
 */
export const DeliverNotification = Workflow.make("DeliverNotification", {
  payload: { deliveryId: Schema.String },
  idempotencyKey: ({ deliveryId }) => deliveryId
})
