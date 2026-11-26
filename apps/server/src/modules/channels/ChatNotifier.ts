import type { Platform } from "@bluechip/domain/channels/Channel"
import { chatNotification } from "@bluechip/domain/channels/ChatCards"
import type { UserId } from "@bluechip/domain/Ids"
import type { Notification } from "@bluechip/domain/notifications/Notification"
import * as Chat from "effect/chat/Chat"
import * as ChatThread from "effect/chat/ChatThread"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AppConfig } from "../../config/AppConfig.ts"
import { NotifierError } from "../notifications/NotifierError.ts"
import { ChannelLinks } from "./ChannelLinks.ts"
import { chatContent } from "./ChatContent.ts"

/**
 * The chat notifier: a notification as a message in each of the user's linked chats on a platform (but not to the
 * chat a link notification is about: the bot told it already), with a link into the app. Skipped when no chat is linked; retried only when the platform said to try again (a message that may have
 * landed is never sent twice).
 */
export class ChatNotifier extends Context.Service<ChatNotifier, {
  readonly send: (
    platform: Platform,
    userId: UserId,
    notification: Notification
  ) => Effect.Effect<"sent" | "skipped", NotifierError>
}>()("@bluechip/server/ChatNotifier") {
  static readonly layer = Layer.effect(
    ChatNotifier,
    Effect.gen(function*() {
      const chat = yield* Chat.Chat
      const links = yield* ChannelLinks
      const { publicOrigin } = yield* AppConfig

      const send = Effect.fn("ChatNotifier.send")(
        function*(platform: Platform, userId: UserId, notification: Notification) {
          // A chat just linked has heard it from the bot; every other chat is told.
          const linked = (yield* links.ofUser(userId, platform)).filter((link) =>
            notification.subjectType !== "channelLink" || notification.subjectId !== link.id
          )
          if (linked.length === 0) return "skipped" as const

          const content = chatContent(chatNotification(notification), publicOrigin)
          yield* Effect.forEach(linked, (link) => chat.post(ChatThread.make(link.platform, link.chatId), content), {
            discard: true
          }).pipe(
            Effect.mapError((error) =>
              new NotifierError({ channel: platform, reason: error.message, retryable: error.retry === "retry" })
            )
          )
          return "sent" as const
        }
      )

      return ChatNotifier.of({ send })
    })
  )
}
