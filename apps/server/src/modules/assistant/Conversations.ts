import type { Card } from "@bluechip/domain/assistant/Card"
import {
  Conversation,
  ConversationThread,
  Message,
  type MessagePart,
  type Surface
} from "@bluechip/domain/assistant/Conversation"
import { NotFound } from "@bluechip/domain/Errors"
import { type AgentId, ConversationId, type MessageId } from "@bluechip/domain/Ids"
import { and, asc, count as countRows, desc, eq, isNotNull, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { Agents } from "../agents/Agents.ts"
import { Analytics } from "../analytics/Analytics.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { assistantCards, conversations, messages } from "./tables.ts"

type ConversationRow = typeof conversations.$inferSelect
type MessageRow = typeof messages.$inferSelect

const toConversation = (row: ConversationRow) =>
  new Conversation({
    id: row.id as ConversationId,
    agentId: row.agentId as AgentId | null,
    surface: row.surface,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  })

const toMessage = (row: MessageRow, cards: ReadonlyMap<string, Card>) =>
  new Message({
    id: row.id as MessageId,
    role: row.role,
    // A message keeps the card it showed; the card's row says what became of it.
    parts: row.parts.map((part) =>
      part.type === "card" ? { ...part, card: cards.get(part.card.id) ?? part.card } : part
    ),
    model: row.model,
    createdAt: row.createdAt
  })

/** What a model round used, stored with its message. */
export interface MessageUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadTokens: number
}

/**
 * Conversations with the assistant and their messages, kept by bluechip: a run reads its history from here, never
 * from the client.
 */
export class Conversations extends Context.Service<Conversations, {
  /** A new conversation, about one of the owner's agents when `agentId` is set, in the app unless `surface` says. */
  readonly start: (owner: Owner, input: {
    readonly agentId: AgentId | null
    readonly surface?: Surface | undefined
  }) => Effect.Effect<Conversation, NotFound>
  /** The owner's conversations, newest first, a page at a time. */
  readonly list: (owner: Owner, query: {
    readonly pageSize?: number | undefined
    readonly pageToken?: string | undefined
  }) => Effect.Effect<{ readonly items: ReadonlyArray<Conversation>; readonly nextPageToken: string | null }>
  readonly owned: (owner: Owner, id: string) => Effect.Effect<Conversation, NotFound>
  /** The conversation with every message, oldest first, each card as it stands now. */
  readonly thread: (owner: Owner, id: string) => Effect.Effect<ConversationThread, NotFound>
  readonly append: (conversationId: ConversationId, message: {
    readonly role: "user" | "assistant"
    readonly parts: ReadonlyArray<MessagePart>
    readonly model?: string | undefined
    readonly usage?: MessageUsage | undefined
  }) => Effect.Effect<Message>
  /** Keeps the context a user message's turn gave the model, so later turns replay it as it was. */
  readonly setContext: (messageId: MessageId, context: string) => Effect.Effect<void>
  /** The contexts the conversation's turns gave the model, by their user message. */
  readonly contexts: (conversationId: ConversationId) => Effect.Effect<ReadonlyMap<string, string>>
  readonly setTitle: (id: ConversationId, title: string) => Effect.Effect<void>
  /**
   * Deletes one of the owner's conversations with what belongs only to it: messages, cards, summary and recall entries
   * (`on delete cascade`). Memories learned from it stay, without their message; a chat linked to it starts afresh.
   */
  readonly remove: (owner: Owner, id: string) => Effect.Effect<void, NotFound>
}>()("@bluechip/server/Conversations") {
  static readonly layer = Layer.effect(
    Conversations,
    Effect.gen(function*() {
      const db = yield* Database
      const agents = yield* Agents
      const analytics = yield* Analytics

      const start = Effect.fn("Conversations.start")(
        function*(owner: Owner, input: { readonly agentId: AgentId | null; readonly surface?: Surface | undefined }) {
          if (input.agentId !== null) yield* agents.find(owner, input.agentId)
          const now = yield* DateTime.now

          const [row] = yield* db.insert(conversations).values({
            id: typeid("conversation").toString() as `conversation_${string}`,
            userId: owner.id as `user_${string}`,
            agentId: input.agentId as `agent_${string}` | null,
            surface: input.surface ?? "web",
            title: null,
            createdAt: now,
            updatedAt: now
          }).returning().pipe(Effect.orDie)
          const [started] = yield* db.select({ count: countRows() }).from(conversations)
            .where(eq(conversations.userId, owner.id as `user_${string}`)).pipe(Effect.orDie)
          yield* analytics.capture(owner.id, {
            _tag: "conversation_started",
            surface: row!.surface,
            has_agent: row!.agentId !== null
          }, { id: row!.id, at: now, set: { assistant_conversations_count: started?.count ?? 1 } })
          return toConversation(row!)
        }
      )

      const list = Effect.fn("Conversations.list")(function*(owner: Owner, query: {
        readonly pageSize?: number | undefined
        readonly pageToken?: string | undefined
      }) {
        const size = query.pageSize ?? 25
        const rows = yield* db.select().from(conversations).where(and(
          eq(conversations.userId, owner.id as `user_${string}`),
          query.pageToken === undefined ? undefined : lt(conversations.id, query.pageToken as `conversation_${string}`)
        )).orderBy(desc(conversations.id)).limit(size + 1).pipe(Effect.orDie)

        const items = rows.slice(0, size).map(toConversation)
        return { items, nextPageToken: rows.length > size ? items.at(-1)!.id as string : null }
      })

      const ownedRow = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const [row] = Schema.is(ConversationId)(id) ?
          yield* db.select().from(conversations).where(and(
            eq(conversations.id, id as `conversation_${string}`),
            eq(conversations.userId, owner.id as `user_${string}`)
          )).pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "conversation", id })
        return row
      })

      const thread = Effect.fn("Conversations.thread")(function*(owner: Owner, id: string) {
        const row = yield* ownedRow(owner, id)
        const [messageRows, cardRows] = yield* Effect.all([
          db.select().from(messages).where(eq(messages.conversationId, row.id))
            .orderBy(asc(messages.createdAt), asc(messages.id)),
          db.select().from(assistantCards).where(eq(assistantCards.conversationId, row.id))
        ], { concurrency: 2 }).pipe(Effect.orDie)

        const cards = new Map(cardRows.map((card) => [card.id as string, card.card]))
        return new ConversationThread({
          conversation: toConversation(row),
          messages: messageRows.map((message) => toMessage(message, cards))
        })
      })

      const append = Effect.fn("Conversations.append")(function*(conversationId: ConversationId, message: {
        readonly role: "user" | "assistant"
        readonly parts: ReadonlyArray<MessagePart>
        readonly model?: string | undefined
        readonly usage?: MessageUsage | undefined
      }) {
        const now = yield* DateTime.now
        const [row] = yield* db.insert(messages).values({
          id: typeid("message").toString() as `message_${string}`,
          conversationId: conversationId as `conversation_${string}`,
          role: message.role,
          parts: message.parts,
          model: message.model ?? null,
          inputTokens: message.usage?.inputTokens ?? 0,
          outputTokens: message.usage?.outputTokens ?? 0,
          cacheReadTokens: message.usage?.cacheReadTokens ?? 0,
          createdAt: now
        }).returning().pipe(Effect.orDie)
        yield* db.update(conversations).set({ updatedAt: now })
          .where(eq(conversations.id, conversationId as `conversation_${string}`)).pipe(Effect.orDie)
        return toMessage(row!, new Map())
      })

      const setContext = Effect.fn("Conversations.setContext")(function*(messageId: MessageId, context: string) {
        yield* db.update(messages).set({ context }).where(eq(messages.id, messageId as `message_${string}`))
          .pipe(Effect.orDie)
      })

      const contexts = Effect.fn("Conversations.contexts")(function*(conversationId: ConversationId) {
        const rows = yield* db.select({ id: messages.id, context: messages.context }).from(messages)
          .where(and(
            eq(messages.conversationId, conversationId as `conversation_${string}`),
            isNotNull(messages.context)
          )).pipe(Effect.orDie)
        return new Map(rows.map((row) => [row.id as string, row.context!]))
      })

      const setTitle = Effect.fn("Conversations.setTitle")(function*(id: ConversationId, title: string) {
        yield* db.update(conversations).set({ title })
          .where(eq(conversations.id, id as `conversation_${string}`)).pipe(Effect.orDie)
      })

      const remove = Effect.fn("Conversations.remove")(function*(owner: Owner, id: string) {
        const row = yield* ownedRow(owner, id)
        yield* db.delete(conversations).where(eq(conversations.id, row.id)).pipe(Effect.orDie)
      })

      return Conversations.of({
        start,
        list,
        owned: Effect.fn("Conversations.owned")(function*(owner: Owner, id: string) {
          return toConversation(yield* ownedRow(owner, id))
        }),
        thread,
        append,
        setContext,
        contexts,
        setTitle,
        remove
      })
    })
  )
}
