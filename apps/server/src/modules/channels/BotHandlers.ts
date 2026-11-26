import { stocks } from "@bluechip/chain/Contracts"
import type { Platform } from "@bluechip/domain/channels/Channel"
import { chatCard } from "@bluechip/domain/channels/ChatCards"
import { HELP, NOT_LINKED, UNLINKED } from "@bluechip/domain/channels/ChatReplies"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as Chat from "effect/chat/Chat"
import * as ChatHandler from "effect/chat/ChatHandler"
import * as ChatInteraction from "effect/chat/ChatInteraction"
import type * as ChatThread from "effect/chat/ChatThread"
import type * as ChatUi from "effect/chat/ChatUi"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Activity from "effect/workflow/Activity"
import * as Workflow from "effect/workflow/Workflow"
import { AppConfig } from "../../config/AppConfig.ts"
import { Agents } from "../agents/Agents.ts"
import { Cards } from "../assistant/Cards.ts"
import { Recoveries } from "../recovery/Recoveries.ts"
import { ChannelLinks } from "./ChannelLinks.ts"
import { ChatBot, ChatMessageIn, type ChatOwner } from "./ChatBot.ts"
import { chatContent } from "./ChatContent.ts"
import { BotInteractions, PauseAgent } from "./Interactions.ts"

const stockName = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol

/**
 * One message to the bot, answered once: chat platforms deliver a message again until it is accepted, and a turn of
 * the assistant takes longer than they wait, so a message is accepted by starting this workflow (keyed by the
 * message) and answered in it.
 */
export const AnswerChatMessage = Workflow.make("AnswerChatMessage", {
  payload: ChatMessageIn.fields,
  idempotencyKey: ({ messageId, platform, threadId }) => `${platform}:${threadId}:${messageId}`
})

export const AnswerChatMessageLive = AnswerChatMessage.toLayer(Effect.fnUntraced(function*(message) {
  const bot = yield* ChatBot
  yield* Activity.make({ name: "answer", execute: bot.answer(message) })
}))

/** Every message people send (not other bots'), handed to `AnswerChatMessage`. */
export const ChatHandlerLive = ChatHandler.layer((event) => {
  if (event._tag !== "MessageCreated" || event.message.author.isBot) return Effect.void
  return AnswerChatMessage.execute({
    platform: event.thread.platform,
    threadId: event.thread.id,
    kind: event.kind,
    authorId: event.message.author.id,
    authorName: event.message.author.name ?? null,
    messageId: event.message.id,
    text: event.message.text
  }, { discard: true }).pipe(
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.andThen(Effect.logWarning("A chat message couldn't be accepted", cause), new ChatHandler.NotAccepted())
    )
  )
})

/**
 * The bot's buttons and commands. A click or command counts only from the person who linked the chat; anyone else
 * gets how to link one. Confirm and Cancel answer the assistant's cards (the message then says what became of the
 * card), Pause pauses an agent, Pause all pauses every agent, and Cancel recovery cancels a recovery waiting out its
 * delay. Commands answer in the chat.
 */
export const BotInteractionsLive = BotInteractions.toLayer(Effect.gen(function*() {
  const bot = yield* ChatBot
  const chat = yield* Chat.Chat
  const cards = yield* Cards
  const agents = yield* Agents
  const links = yield* ChannelLinks
  const recoveries = yield* Recoveries
  const { publicOrigin } = yield* AppConfig

  const PAUSED_ALL = "Every agent is paused. Nothing was sold. Resume them in bluechip."

  // Cancelling only takes power away, so a chat can do it: bluechip's guard key sends the cancel.
  const cancelRecovery = (who: ChatOwner) =>
    recoveries.cancel(who.owner.id, "telegram").pipe(
      Effect.as(
        "The recovery is cancelled. Your passkeys stay as they are. If you didn't ask for it, remove your " +
          "recovery key in bluechip's Settings."
      ),
      Effect.catchTags({
        Conflict: () => Effect.succeed("There's no recovery of your account waiting to be cancelled."),
        Unavailable: () => Effect.succeed("Base didn't answer, so the recovery isn't cancelled yet. Try again now.")
      })
    )

  const respond = (markdown: string, actions?: ReadonlyArray<ChatUi.Action>) =>
    ChatInteraction.respond({ markdown, visibility: "public", ...(actions === undefined ? {} : { actions }) })

  const edit = (thread: ChatThread.ChatThread, messageId: string, markdown: string) =>
    chat.edit(thread, messageId, chatContent({ markdown, actions: [] }, publicOrigin)).pipe(
      Effect.catch((error) => Effect.logWarning("A chat message couldn't be changed", error))
    )

  const answerCard = (confirmed: boolean) =>
    Effect.fnUntraced(function*(click: ChatInteraction.Click<string>) {
      const who = yield* bot.ownerOf(click.thread, click.userId)
      if (who === undefined) return ChatInteraction.ack
      const answered = yield* (confirmed ? cards.confirm : cards.dismiss)(who.owner, click.value).pipe(
        Effect.map((card) =>
          chatCard(card, { stock: stockName, conversationPath: `/chat/${who.link.conversationId}` })?.markdown ??
            "Done."
        ),
        Effect.catchTags({
          Conflict: () => Effect.succeed("This was already answered, so there's nothing left to do."),
          NotFound: () => Effect.succeed("That's no longer here."),
          InvalidSpec: (error) => Effect.succeed(error.problems.map((problem) => problem.message).join(" ")),
          InvalidAutomation: (error) => Effect.succeed(error.problems.map((problem) => problem.message).join(" "))
        })
      )
      yield* edit(click.thread, click.messageId, answered)
      return ChatInteraction.ack
    })

  // A command from a chat that isn't linked, or from someone else in it, gets how to link one.
  const linked = (
    event: ChatInteraction.CommandInvoked,
    run: (who: ChatOwner) => Effect.Effect<ChatInteraction.Respond>
  ): Effect.Effect<ChatInteraction.Respond> =>
    Effect.flatMap(
      bot.ownerOf(event.thread, event.userId),
      (who) => who === undefined ? Effect.succeed(respond(NOT_LINKED)) : run(who)
    )

  return BotInteractions.of({
    confirm: answerCard(true),
    cancel: answerCard(false),
    pauseAgent: Effect.fnUntraced(function*(click) {
      const who = yield* bot.ownerOf(click.thread, click.userId)
      if (who === undefined) return ChatInteraction.ack
      const said = yield* agents.pause(who.owner, click.value as AgentId).pipe(
        Effect.map((agent) => `${agent.name} is paused. It can't trade until you resume it in bluechip.`),
        Effect.catchTags({
          NotFound: () => Effect.succeed("That agent is no longer here."),
          Conflict: () => Effect.succeed("That agent can't be paused now: it isn't running.")
        })
      )
      yield* edit(click.thread, click.messageId, said)
      return ChatInteraction.ack
    }),
    pauseAll: Effect.fnUntraced(function*(click) {
      const who = yield* bot.ownerOf(click.thread, click.userId)
      if (who === undefined) return ChatInteraction.ack
      yield* agents.pauseAll(who.owner)
      yield* chat.post(click.thread, chatContent({ markdown: PAUSED_ALL, actions: [] }, publicOrigin)).pipe(
        Effect.catch((error) => Effect.logWarning("A chat message couldn't be sent", error))
      )
      return ChatInteraction.ack
    }),
    cancelRecovery: Effect.fnUntraced(function*(click) {
      const who = yield* bot.ownerOf(click.thread, click.userId)
      if (who === undefined) return ChatInteraction.ack
      const said = yield* cancelRecovery(who)
      yield* chat.post(click.thread, chatContent({ markdown: said, actions: [] }, publicOrigin)).pipe(
        Effect.catch((error) => Effect.logWarning("A chat message couldn't be sent", error))
      )
      return ChatInteraction.ack
    }),
    start: Effect.fnUntraced(function*(event) {
      const code = event.text.trim()
      if (code.length > 0) {
        const kind = yield* chat.getThread(event.thread).pipe(
          Effect.map((info) => info.kind),
          Effect.orElseSucceed(() => "channel" as const)
        )
        return respond(
          yield* bot.link({
            platform: event.thread.platform,
            threadId: event.thread.id,
            kind,
            authorId: event.userId,
            authorName: null
          }, code.toUpperCase())
        )
      }
      const who = yield* bot.ownerOf(event.thread, event.userId)
      return respond(who === undefined ? NOT_LINKED : HELP)
    }),
    portfolio: (event) => linked(event, (who) => Effect.map(bot.portfolio(who.owner), (text) => respond(text))),
    agents: (event) => linked(event, (who) => Effect.map(bot.agents(who.owner), (text) => respond(text))),
    pause: (event) =>
      linked(event, (who) =>
        Effect.map(agents.list(who.owner), (all) => {
          const trading = all.filter((agent) => agent.status === "active" && !agent.paused)
          return trading.length === 0 ?
            respond("None of your agents is trading right now.") :
            respond(
              "Which agent should stop trading?",
              trading.map((agent) => PauseAgent.of(agent.id, { label: agent.name }))
            )
        })),
    pause_all: (event) => linked(event, (who) => Effect.map(agents.pauseAll(who.owner), () => respond(PAUSED_ALL))),
    cancel_recovery: (event) => linked(event, (who) => Effect.map(cancelRecovery(who), (said) => respond(said))),
    unlink: (event) =>
      linked(
        event,
        () => Effect.as(links.unlinkChat(event.thread.platform as Platform, event.thread.id), respond(UNLINKED))
      ),
    help: (event) =>
      Effect.map(bot.ownerOf(event.thread, event.userId), (who) => respond(who === undefined ? NOT_LINKED : HELP))
  })
})).pipe(Layer.provideMerge(ChatInteraction.layer()))
