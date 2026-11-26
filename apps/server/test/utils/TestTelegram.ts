// Telegram chats with the bot, in memory (`TelegramTest`, the server's `ChatTest`): a person writes, types a command
// or clicks a button the way Telegram delivers it, and the test reads what the bot posted back. A message is answered
// by its `AnswerChatMessage` workflow; `say` waits for it by executing it again (it is keyed by the message).
//
// Chats are numbered by the in-memory chat, so two test files making them would share chat ids in the one test
// database: only `e2e/channels/Telegram.test.ts` makes them.
import { Forbidden } from "effect/chat/ChatError"
import type * as ChatHandler from "effect/chat/ChatHandler"
import type * as ChatInteraction from "effect/chat/ChatInteraction"
import * as ChatTest from "effect/chat/ChatTest"
import type * as ChatThread from "effect/chat/ChatThread"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { randomUUID } from "node:crypto"
import { AnswerChatMessage } from "../../src/modules/channels/BotHandlers.ts"
import type { TestUser } from "./TestUsers.ts"
import { TestUsers } from "./TestUsers.ts"

/** A chat with the bot and the person in it. */
export interface TestChat {
  readonly thread: ChatThread.ChatThread
  readonly person: string
}

/** A message the bot posted: its id (to click its buttons) and its Markdown. */
export interface BotMessage {
  readonly id: string
  readonly text: string
}

export class TestTelegram extends Context.Service<TestTelegram, {
  /** A new chat with the bot: private (`direct`) unless a group (`channel`) is asked for. */
  readonly chat: (kind?: "direct" | "channel") => Effect.Effect<TestChat>
  /** A new private chat, linked to `user` with a code from the app. */
  readonly linked: (user: TestUser) => Effect.Effect<TestChat>
  /** The person writes `text`; the bot's messages posted in answer. */
  readonly say: (chat: TestChat, text: string) => Effect.Effect<ReadonlyArray<BotMessage>>
  /** The person types a command; the bot's answer (`Late` if it ran out of time). */
  readonly command: (
    chat: TestChat,
    id: string,
    text?: string
  ) => Effect.Effect<ChatInteraction.CommandReply | ChatInteraction.Late>
  /** The person clicks a button on one of the bot's messages; the message as it reads afterwards. */
  readonly click: (chat: TestChat, message: BotMessage, button: string) => Effect.Effect<string>
  /** Every message the bot posted in the chat, oldest first. */
  readonly posted: (chat: TestChat) => Effect.Effect<ReadonlyArray<BotMessage>>
  /** The person blocks the bot: Telegram refuses the bot's next message (403 "bot was blocked by the user"). */
  readonly blocks: Effect.Effect<void>
}>()("@bluechip/server/test/TestTelegram") {
  static readonly layerNoDeps = Layer.effect(
    TestTelegram,
    Effect.gen(function*() {
      const telegram = yield* ChatTest.ChatTest
      const context = yield* Effect.context<ChatHandler.ChatHandler | ChatInteraction.Handler>()
      const engine = yield* WorkflowEngine.WorkflowEngine

      const posted = (chat: TestChat) =>
        Effect.map(
          telegram.messages(chat.thread),
          (messages) => messages.filter((message) => message.author.isSelf).map(({ id, text }) => ({ id, text }))
        )

      const chat = (kind: "direct" | "channel" = "direct") =>
        Effect.map(telegram.makeThread(kind), (thread) => ({ thread, person: randomUUID() }))

      const say = Effect.fnUntraced(function*(chat: TestChat, text: string) {
        const before = (yield* posted(chat)).length
        const event = yield* telegram.userPosts(chat.thread, { text, authorId: chat.person })
        if (event._tag !== "MessageCreated") return yield* Effect.die(new Error("not a message"))

        yield* telegram.deliver(event).pipe(Effect.provideContext(context), Effect.orDie)
        yield* AnswerChatMessage.execute({
          platform: event.thread.platform,
          threadId: event.thread.id,
          kind: event.kind,
          authorId: chat.person,
          authorName: null,
          messageId: event.message.id,
          text
        }).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine), Effect.orDie)
        return (yield* posted(chat)).slice(before)
      })

      const linked = Effect.fnUntraced(function*(user: TestUser) {
        const linking = yield* chat("direct")
        const { code } = yield* Effect.orDie(user.api.channels.linkCode({ params: { platform: "telegram" } }))
        yield* say(linking, code)
        return linking
      })

      const command = (chat: TestChat, id: string, text?: string) =>
        Effect.flatMap(
          telegram.command(chat.thread, id, { userId: chat.person, ...(text === undefined ? {} : { text }) }),
          (event) => telegram.interact(event)
        ).pipe(Effect.provideContext(context))

      const click = Effect.fnUntraced(function*(chat: TestChat, message: BotMessage, button: string) {
        const event = yield* Effect.orDie(telegram.click(message.id, button, { userId: chat.person }))
        yield* telegram.interact(event).pipe(Effect.provideContext(context))
        const after = (yield* posted(chat)).find((found) => found.id === message.id)
        return after?.text ?? ""
      })

      const blocks = telegram.failNext("post", new Forbidden({ detail: "blocked" }))

      return { chat, linked, say, command, click, posted, blocks }
    })
  )

  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layer))
}
