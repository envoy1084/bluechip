import type { UserId } from "@bluechip/domain/Ids"
import type { Notification } from "@bluechip/domain/notifications/Notification"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChatNotifier } from "../channels/ChatNotifier.ts"
import { PushNotifier } from "../push/PushNotifier.ts"
import type { NotifierError } from "./NotifierError.ts"

/** The channels a notification is delivered on beside the center. */
type DeliveryChannel = "push" | "telegram"

/** What a notifier did: sent it, or had nowhere to send it (no device opted in, no chat linked). */
type NotifierOutcome = "sent" | "skipped"

/**
 * The notifier catalog: one notifier per channel, each with its own words for a notification (a push's title and
 * body, a chat message with its link). Deliveries go through here and never to a platform directly.
 */
export class Notifiers extends Context.Service<Notifiers, {
  readonly send: (
    channel: DeliveryChannel,
    userId: UserId,
    notification: Notification
  ) => Effect.Effect<NotifierOutcome, NotifierError>
}>()("@bluechip/server/Notifiers") {
  static readonly layer = Layer.effect(
    Notifiers,
    Effect.gen(function*() {
      const push = yield* PushNotifier
      const chat = yield* ChatNotifier

      return Notifiers.of({
        send: (channel, userId, notification) => {
          switch (channel) {
            case "push":
              return push.send(userId, notification)
            case "telegram":
              return chat.send("telegram", userId, notification)
          }
        }
      })
    })
  )
}
