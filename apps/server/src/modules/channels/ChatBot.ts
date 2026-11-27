import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import { linkCodeIn, type Platform } from "@bluechip/domain/channels/Channel"
import { chatCard, type ChatReply } from "@bluechip/domain/channels/ChatCards"
import {
  BUSY,
  chatAgents,
  chatPortfolio,
  CODE_REFUSED,
  LINKED,
  NOT_LINKED,
  PRIVATE_ONLY
} from "@bluechip/domain/channels/ChatReplies"
import type { ConversationId, UserId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as Chat from "effect/chat/Chat"
import * as ChatThread from "effect/chat/ChatThread"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { randomUUID } from "node:crypto"
import type { Address } from "viem"
import { AppConfig } from "../../config/AppConfig.ts"
import { Accounts } from "../accounts/Accounts.ts"
import { Agents } from "../agents/Agents.ts"
import { Assistant } from "../assistant/Assistant.ts"
import { Conversations } from "../assistant/Conversations.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { type ChannelLinkRow, ChannelLinks } from "./ChannelLinks.ts"
import { chatContent } from "./ChatContent.ts"

/** A message someone sent the bot: where, who, and what it said. */
export const ChatMessageIn = Schema.Struct({
  platform: Schema.String,
  threadId: Schema.String,
  /** A private chat with the bot (`direct`), or a group. */
  kind: Schema.Literals(["channel", "thread", "direct"]),
  authorId: Schema.String,
  authorName: Schema.NullOr(Schema.String),
  messageId: Schema.String,
  text: Schema.String
})

export type ChatMessageIn = typeof ChatMessageIn.Type

/** Who is talking in a linked chat: the account it is linked to, and the link. */
export interface ChatOwner {
  readonly owner: Owner
  readonly link: ChannelLinkRow
}

/**
 * bluechip on a chat platform. A chat that isn't linked gets only how to link it, and links with the code from the
 * app (in a private chat). A linked chat talks to the same assistant as the app, in a conversation of its own: its
 * tools keep their risk levels, its cards come back as messages (Confirm and Cancel for what waits for you, a link
 * into the app for what needs your passkey), and nothing is signed here. Its commands read the portfolio and agents
 * and pause agents.
 */
export class ChatBot extends Context.Service<ChatBot, {
  /** Answers a message: links the chat, or runs the assistant, or tells a stranger how to link. */
  readonly answer: (message: ChatMessageIn) => Effect.Effect<void>
  /** Links a private chat with a code; the reply to send. */
  readonly link: (
    message: Pick<ChatMessageIn, "platform" | "threadId" | "kind" | "authorId" | "authorName">,
    code: string
  ) => Effect.Effect<string>
  /** The account a chat is linked to, when `userId` is the person who linked it. */
  readonly ownerOf: (thread: ChatThread.ChatThread, userId: string) => Effect.Effect<ChatOwner | undefined>
  /** Replies to commands. */
  readonly portfolio: (owner: Owner) => Effect.Effect<string>
  readonly agents: (owner: Owner) => Effect.Effect<string>
}>()("@bluechip/server/ChatBot") {
  static readonly layer = Layer.effect(
    ChatBot,
    Effect.gen(function*() {
      const chat = yield* Chat.Chat
      const links = yield* ChannelLinks
      const accounts = yield* Accounts
      const assistant = yield* Assistant
      const conversations = yield* Conversations
      const agents = yield* Agents
      const balances = yield* AccountBalances
      const { stocks } = yield* ChainDeployment
      const stockName = (symbol: StockSymbol) => stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
      const market = yield* MarketPrices
      const { publicOrigin } = yield* AppConfig

      const post = (thread: ChatThread.ChatThread, reply: ChatReply) =>
        chat.post(thread, chatContent(reply, publicOrigin)).pipe(
          Effect.catch((error) => Effect.logWarning("A chat reply couldn't be sent", error))
        )

      const say = (thread: ChatThread.ChatThread, markdown: string) => post(thread, { markdown, actions: [] })

      const ownerOf = Effect.fn("ChatBot.ownerOf")(function*(thread: ChatThread.ChatThread, userId: string) {
        const link = yield* links.ofChat(thread.platform as Platform, thread.id)
        if (link === undefined || link.externalUserId !== userId) return undefined
        const me = yield* accounts.me(link.userId as UserId)
        return { owner: { id: me.user.id, account: me.account.address }, link }
      })

      const link = Effect.fn("ChatBot.link")(function*(
        message: Pick<ChatMessageIn, "platform" | "threadId" | "kind" | "authorId" | "authorName">,
        code: string
      ) {
        if (message.kind !== "direct") return PRIVATE_ONLY
        const linked = yield* links.redeem(code, {
          platform: message.platform as Platform,
          chatId: message.threadId,
          externalUserId: message.authorId,
          name: message.authorName
        })
        return linked === undefined ? CODE_REFUSED : LINKED
      })

      const conversationOf = Effect.fnUntraced(function*({ link, owner }: ChatOwner) {
        if (link.conversationId !== null) return link.conversationId as ConversationId
        const started = yield* conversations.start(owner, { agentId: null, surface: "telegram" }).pipe(Effect.orDie)
        yield* links.setConversation(link.id, started.id)
        return started.id
      })

      // One turn of the assistant, its text and cards posted in the order they came.
      const converse = Effect.fnUntraced(function*(
        thread: ChatThread.ChatThread,
        who: ChatOwner,
        text: string
      ) {
        const conversationId = yield* conversationOf(who)
        const events = yield* assistant.run(who.owner, {
          threadId: conversationId,
          runId: randomUUID(),
          messages: [{ id: randomUUID(), role: "user", content: text }],
          tools: [],
          context: []
        }).pipe(Effect.option)
        if (events._tag === "None") return yield* say(thread, BUSY)

        const conversationPath = `/chat/${conversationId}`
        let pending = ""
        const flush = Effect.suspend(() => {
          const said = pending.trim()
          pending = ""
          return said.length === 0 ? Effect.void : say(thread, said)
        })
        yield* events.value.pipe(Stream.runForEach((event) => {
          switch (event.type) {
            case "TEXT_MESSAGE_CONTENT":
              pending += event.delta
              return Effect.void
            case "TEXT_MESSAGE_END":
              pending += "\n\n"
              return Effect.void
            case "RUN_ERROR":
              pending += `\n\n${event.message}`
              return Effect.void
            case "CUSTOM": {
              if (event.name !== CARD_EVENT) return Effect.void
              const { card } = Schema.decodeUnknownSync(Schema.toCodecJson(CardEvent.fields.value))(event.value)
              const reply = chatCard(card, { stock: stockName, conversationPath })
              return Effect.andThen(flush, reply === undefined ? Effect.void : post(thread, reply))
            }
            default:
              return Effect.void
          }
        }))
        yield* flush
      })

      const answer = Effect.fn("ChatBot.answer")(function*(message: ChatMessageIn) {
        const thread = ChatThread.make(message.platform, message.threadId)
        const text = message.text.trim()
        if (text.length === 0) return

        const who = yield* ownerOf(thread, message.authorId)
        if (who === undefined) {
          const code = linkCodeIn(text)
          return yield* say(thread, code === null ? NOT_LINKED : yield* link(message, code))
        }
        yield* converse(thread, who, text)
      })

      const portfolio = Effect.fn("ChatBot.portfolio")(function*(owner: Owner) {
        const holdings = yield* balances.of(owner.account as Address).pipe(Effect.option)
        if (holdings._tag === "None") {
          return "Base isn't answering, so I can't read your account. Try again in a moment."
        }
        return chatPortfolio(valueHoldings(holdings.value, yield* market.prices, yield* DateTime.now), stockName)
      })

      return ChatBot.of({
        answer,
        link,
        ownerOf,
        portfolio,
        agents: (owner) => Effect.map(agents.list(owner), chatAgents)
      })
    })
  )
}
