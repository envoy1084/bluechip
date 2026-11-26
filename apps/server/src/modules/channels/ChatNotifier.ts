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
import { IntentStore } from "../intents/IntentStore.ts"
import { NotifierError } from "../notifications/NotifierError.ts"
import { ChannelLinks } from "./ChannelLinks.ts"
import { chatContent } from "./ChatContent.ts"

/**
 * The chat notifier: a notification as a message in each of the user's linked chats on a platform, with a link into
 * the app. Not to the chat a notification already reached another way: a link notification's chat (the bot told it),
 * or the chat whose conversation asked for an approval (the assistant's card is there). A chat whose person blocked
 * the bot is unlinked, which tells the user on their other channels. Skipped when no chat is left; retried only when
 * the platform said to try again (a message that may have landed is never sent twice).
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
      const intents = yield* IntentStore
      const { publicOrigin } = yield* AppConfig

      // The conversation an approval was asked for in, when a chat's assistant asked for it.
      const askedIn = Effect.fnUntraced(function*(notification: Notification) {
        if (notification.kind !== "approvalNeeded" || notification.subjectId === null) return null
        const intent = yield* intents.find(notification.subjectId)
        return intent?.source === "channel" ? intent.sourceId : null
      })

      const send = Effect.fn("ChatNotifier.send")(
        function*(platform: Platform, userId: UserId, notification: Notification) {
          const conversation = yield* askedIn(notification)
          const linked = (yield* links.ofUser(userId, platform)).filter((link) =>
            (notification.subjectType !== "channelLink" || notification.subjectId !== link.id) &&
            (conversation === null || link.conversationId !== conversation)
          )
          if (linked.length === 0) return "skipped" as const

          const content = chatContent(chatNotification(notification), publicOrigin)
          const sent = yield* Effect.forEach(
            linked,
            (link) =>
              chat.post(ChatThread.make(link.platform, link.chatId), content).pipe(
                Effect.as(true),
                Effect.catchReason("ChatError", "Forbidden", (reason, error) =>
                  reason.detail === "blocked" || reason.detail === "kicked" ?
                    Effect.as(links.blocked(link.platform, link.chatId), false) :
                    Effect.fail(error))
              )
          ).pipe(
            Effect.mapError((error) =>
              new NotifierError({ channel: platform, reason: error.message, retryable: error.retry === "retry" })
            )
          )
          return sent.some((posted) => posted) ? "sent" as const : "skipped" as const
        }
      )

      return ChatNotifier.of({ send })
    })
  )
}
