import {
  ConversationSummary,
  Memory,
  type MemoryCandidate,
  MemoryExport,
  type MemoryKind,
  planMemoryWrite
} from "@bluechip/domain/assistant/Memory"
import {
  fitBudget,
  importanceOf,
  PROMPT_BUDGET,
  type RecallHit,
  selectMemories
} from "@bluechip/domain/assistant/Recall"
import { NotFound } from "@bluechip/domain/Errors"
import { type AgentId, type ConversationId, MemoryId, type MessageId, type UserId } from "@bluechip/domain/Ids"
import { and, asc, count, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { messages } from "../assistant/tables.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { Recall } from "./Recall.ts"
import { RecallIndex } from "./RecallIndex.ts"
import { conversationSummaries, memories, memoryUses, recallEntries } from "./tables.ts"

type MemoryRow = typeof memories.$inferSelect

const toMemory = (row: MemoryRow, uses: number) =>
  new Memory({
    id: row.id as MemoryId,
    agentId: row.agentId as AgentId | null,
    kind: row.kind,
    text: row.text,
    source: row.source,
    confidence: row.confidence,
    note: row.note,
    messageId: row.messageId as MessageId | null,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    uses
  })

// The longest a recalled message or summary is in a prompt: the start says what it was about.
const RECALLED_LENGTH = 500

/** What a prompt carries from memory: the memories within the budget, and what was recalled from earlier. */
export interface PromptMemory {
  readonly memories: ReadonlyArray<Memory>
  readonly recalled: ReadonlyArray<RecallHit>
}

/**
 * What the assistant remembers about each user. Confirmed memories go into its prompts (within the budget, the ones
 * recalled for the message first); unconfirmed ones (inferences it isn't sure of) wait for the user. Deleting a
 * memory deletes it and the conversation turn it came from, with what can be recalled of them and the conversation's
 * summary when it covered that turn; forgetting everything also deletes the user's conversation summaries and what
 * can be recalled from their messages.
 */
export class Memories extends Context.Service<Memories, {
  /** Every memory, newest first, confirmed or not; with `text`, the ones it recalls, best first. */
  readonly list: (owner: Owner, query?: { readonly text?: string | undefined }) => Effect.Effect<ReadonlyArray<Memory>>
  /**
   * The memories and earlier context for a turn's prompt. Memories recalled for the message count as used by the turn
   * (`messageId`, the user's message).
   */
  readonly forPrompt: (owner: Owner, turn: {
    readonly text: string
    readonly agentId: AgentId | null
    readonly conversationId: ConversationId
    readonly messageId: MessageId
  }) => Effect.Effect<PromptMemory>
  /** What the user asked to be remembered: confirmed at once. */
  readonly remember: (owner: Owner, input: {
    readonly kind: MemoryKind
    readonly text: string
    readonly agentId: AgentId | null
    readonly messageId: MessageId | null
  }) => Effect.Effect<Memory>
  /** Writes what the small model proposed after a turn; returns the memory added or changed, if any. */
  readonly learn: (owner: Owner, candidate: MemoryCandidate, messageId: MessageId | null) => Effect.Effect<
    Memory | undefined
  >
  /** Confirms a memory so prompts use it; one already confirmed is returned as it is. */
  readonly confirm: (owner: Owner, id: string) => Effect.Effect<Memory, NotFound>
  /**
   * Deletes a memory with its recall entry and uses, and the conversation turn it came from (its messages, what can
   * be recalled of them, and the summary that covered them); returns the memory as it was. A memory from `during`,
   * the turn the assistant is answering now, leaves that turn as it is.
   */
  readonly remove: (owner: Owner, id: string, during?: MessageId | undefined) => Effect.Effect<Memory, NotFound>
  /** Deletes a guess turned down, alone: the conversation it came from stays as it is. */
  readonly discard: (owner: Owner, id: string) => Effect.Effect<Memory, NotFound>
  /** Forgets everything: every memory, conversation summary and recall entry of the user's conversations. */
  readonly removeAll: (owner: Owner) => Effect.Effect<void>
  /** Everything remembered, to download. */
  readonly export: (owner: Owner) => Effect.Effect<MemoryExport>
  /** Deletes guesses still unconfirmed after `days` (everyone's, or one user's); returns how many. */
  readonly dropStale: (days: number, options?: { readonly userId?: UserId | undefined }) => Effect.Effect<number>
}>()("@bluechip/server/Memories") {
  static readonly layer = Layer.effect(
    Memories,
    Effect.gen(function*() {
      const db = yield* Database
      const recall = yield* Recall
      const recallIndex = yield* RecallIndex

      const ofOwner = (owner: Owner) => eq(memories.userId, owner.id as `user_${string}`)
      const byId = (owner: Owner, id: string) => and(ofOwner(owner), eq(memories.id, id as `memory_${string}`))

      const withUses = Effect.fnUntraced(function*(rows: ReadonlyArray<MemoryRow>) {
        const counts = rows.length === 0 ? [] : yield* db.select({ memoryId: memoryUses.memoryId, uses: count() })
          .from(memoryUses).where(inArray(memoryUses.memoryId, rows.map((row) => row.id)))
          .groupBy(memoryUses.memoryId).pipe(Effect.orDie)
        const uses = new Map(counts.map((row) => [row.memoryId as string, row.uses]))
        return rows.map((row) => toMemory(row, uses.get(row.id) ?? 0))
      })

      const one = Effect.fnUntraced(function*(row: MemoryRow) {
        return (yield* withUses([row]))[0]!
      })

      const all = Effect.fnUntraced(function*(owner: Owner) {
        return yield* withUses(
          yield* db.select().from(memories).where(ofOwner(owner)).orderBy(desc(memories.id)).pipe(Effect.orDie)
        )
      })

      const list = Effect.fn("Memories.list")(
        function*(owner: Owner, query: { readonly text?: string | undefined } = {}) {
          if (query.text === undefined || query.text.trim().length === 0) return yield* all(owner)

          const hits = yield* recall.search(owner, {
            text: query.text,
            kinds: ["memory"],
            includeUnconfirmed: true,
            limit: 50
          })
          const found = yield* all(owner)
          return hits.flatMap((hit) => found.filter((memory) => memory.id === hit.sourceId))
        }
      )

      const forPrompt = Effect.fn("Memories.forPrompt")(function*(owner: Owner, turn: {
        readonly text: string
        readonly agentId: AgentId | null
        readonly conversationId: ConversationId
        readonly messageId: MessageId
      }) {
        const [known, hits] = yield* Effect.all([
          all(owner),
          recall.search(owner, {
            text: turn.text,
            agentId: turn.agentId,
            excludeConversation: turn.conversationId,
            limit: 20
          })
        ], { concurrency: 2 })

        const relevant = hits.flatMap((hit) => hit.kind === "memory" ? [hit.sourceId] : [])
        const selected = selectMemories(known, relevant, PROMPT_BUDGET.memories)
        const used = selected.filter((memory) => relevant.includes(memory.id))
        if (used.length > 0) {
          const now = yield* DateTime.now
          yield* db.insert(memoryUses).values(used.map((memory) => ({
            memoryId: memory.id as `memory_${string}`,
            messageId: turn.messageId as `message_${string}`,
            at: now
          }))).onConflictDoNothing().pipe(Effect.orDie)
          yield* db.update(memories).set({ lastUsedAt: now })
            .where(inArray(memories.id, used.map((memory) => memory.id as `memory_${string}`))).pipe(Effect.orDie)
        }

        const earlier = hits.filter((hit) => hit.kind !== "memory").map((hit) =>
          hit.text.length <= RECALLED_LENGTH ? hit : { ...hit, text: `${hit.text.slice(0, RECALLED_LENGTH - 1)}…` }
        )
        return { memories: selected, recalled: fitBudget(earlier, PROMPT_BUDGET.recalled) as ReadonlyArray<RecallHit> }
      })

      const insert = Effect.fnUntraced(function*(owner: Owner, memory: {
        readonly agentId: AgentId | null
        readonly kind: MemoryKind
        readonly text: string
        readonly source: "said" | "inferred"
        readonly confidence: number
        readonly note: string | null
        readonly messageId: MessageId | null
        readonly confirmed: boolean
      }) {
        const now = yield* DateTime.now
        const [row] = yield* db.insert(memories).values({
          id: typeid("memory").toString() as `memory_${string}`,
          userId: owner.id as `user_${string}`,
          agentId: memory.agentId as `agent_${string}` | null,
          kind: memory.kind,
          text: memory.text,
          source: memory.source,
          confidence: memory.confidence,
          note: memory.note,
          messageId: memory.messageId as `message_${string}` | null,
          confirmedAt: memory.confirmed ? now : null,
          createdAt: now,
          lastUsedAt: null
        }).returning().pipe(Effect.orDie)

        yield* recallIndex.index([{
          kind: "memory",
          sourceId: row!.id,
          userId: owner.id,
          agentId: memory.agentId,
          conversationId: null,
          text: memory.text,
          importance: importanceOf({ kind: "memory", memory }),
          at: now
        }])
        return toMemory(row!, 0)
      })

      const remember = Effect.fn("Memories.remember")(function*(owner: Owner, input: {
        readonly kind: MemoryKind
        readonly text: string
        readonly agentId: AgentId | null
        readonly messageId: MessageId | null
      }) {
        return yield* insert(owner, { ...input, source: "said", confidence: 1, note: null, confirmed: true })
      })

      const confirm = Effect.fn("Memories.confirm")(function*(owner: Owner, id: string) {
        if (!Schema.is(MemoryId)(id)) return yield* new NotFound({ resource: "memory", id })

        const [confirmed] = yield* db.update(memories).set({ confirmedAt: yield* DateTime.now })
          .where(and(byId(owner, id), isNull(memories.confirmedAt))).returning().pipe(Effect.orDie)
        const [row] = confirmed === undefined ?
          yield* db.select().from(memories).where(byId(owner, id)).pipe(Effect.orDie) :
          [confirmed]
        if (row === undefined) return yield* new NotFound({ resource: "memory", id })
        return yield* one(row)
      })

      // Deletes the turn a memory came from: the user's message and the answers up to their next message. Their recall
      // entries and uses go with them (`on delete cascade`), and so does a summary that covered any of them: the next
      // turn summarises the conversation again without it.
      const deleteTurn = Effect.fnUntraced(function*(messageId: MessageId) {
        const [source] = yield* db.select().from(messages).where(eq(messages.id, messageId as `message_${string}`))
          .pipe(Effect.orDie)
        if (source === undefined) return
        const following = yield* db.select({ id: messages.id, role: messages.role, createdAt: messages.createdAt })
          .from(messages).where(and(
            eq(messages.conversationId, source.conversationId),
            gte(messages.createdAt, source.createdAt)
          )).orderBy(asc(messages.createdAt), asc(messages.id)).pipe(Effect.orDie)

        const next = following.findIndex((message, index) => index > 0 && message.role === "user")
        const turn = following.slice(0, next === -1 ? following.length : next).map((message) => message.id)
        yield* db.transaction(() =>
          Effect.gen(function*() {
            const [summary] = yield* db.select({ through: messages.createdAt }).from(conversationSummaries)
              .innerJoin(messages, eq(messages.id, conversationSummaries.throughMessageId))
              .where(eq(conversationSummaries.conversationId, source.conversationId))
            if (summary !== undefined && DateTime.isGreaterThanOrEqualTo(summary.through, source.createdAt)) {
              yield* db.delete(conversationSummaries)
                .where(eq(conversationSummaries.conversationId, source.conversationId))
            }
            yield* db.delete(messages).where(and(
              eq(messages.conversationId, source.conversationId),
              inArray(messages.id, turn)
            ))
          })
        ).pipe(Effect.orDie)
      })

      // Deletes a memory alone; its recall entry and uses go with it (`on delete cascade`).
      const drop = Effect.fnUntraced(function*(owner: Owner, id: string) {
        const [row] = Schema.is(MemoryId)(id) ?
          yield* db.select().from(memories).where(byId(owner, id)).pipe(Effect.orDie) :
          []
        if (row === undefined) return yield* new NotFound({ resource: "memory", id })
        const memory = yield* one(row)
        yield* db.delete(memories).where(byId(owner, id)).pipe(Effect.orDie)
        return memory
      })

      const remove = Effect.fn("Memories.remove")(function*(owner: Owner, id: string, during?: MessageId | undefined) {
        const memory = yield* drop(owner, id)
        if (memory.messageId !== null && memory.messageId !== during) yield* deleteTurn(memory.messageId)
        return memory
      })

      const learn = Effect.fn("Memories.learn")(function*(
        owner: Owner,
        candidate: MemoryCandidate,
        messageId: MessageId | null
      ) {
        const existing = yield* all(owner)
        const write = planMemoryWrite(existing, candidate)
        const fields = { ...candidate, text: candidate.text.trim(), agentId: null, messageId }

        switch (write._tag) {
          case "Skip":
            return undefined
          case "Add":
            return yield* insert(owner, { ...fields, note: null, confirmed: write.confirmed })
          case "Refresh":
            return yield* Effect.orDie(confirm(owner, write.memoryId))
          case "Replace": {
            yield* Effect.orDie(drop(owner, write.memoryId))
            return yield* insert(owner, { ...fields, note: write.note, confirmed: write.confirmed })
          }
        }
      })

      const removeAll = Effect.fn("Memories.removeAll")(function*(owner: Owner) {
        const userId = owner.id as `user_${string}`
        yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.delete(memories).where(eq(memories.userId, userId))
            yield* tx.delete(conversationSummaries).where(eq(conversationSummaries.userId, userId))
            yield* tx.delete(recallEntries).where(and(
              eq(recallEntries.userId, userId),
              inArray(recallEntries.kind, ["memory", "message", "summary"])
            ))
          })
        ).pipe(Effect.orDie)
      })

      const exportAll = Effect.fn("Memories.export")(function*(owner: Owner) {
        const summaries = yield* db.select().from(conversationSummaries)
          .where(eq(conversationSummaries.userId, owner.id as `user_${string}`))
          .orderBy(desc(conversationSummaries.updatedAt)).pipe(Effect.orDie)
        return new MemoryExport({
          exportedAt: yield* DateTime.now,
          memories: yield* all(owner),
          summaries: summaries.map((row) =>
            new ConversationSummary({
              conversationId: row.conversationId as ConversationId,
              text: row.text,
              updatedAt: row.updatedAt
            })
          )
        })
      })

      const dropStale = Effect.fn("Memories.dropStale")(function*(
        days: number,
        options: { readonly userId?: UserId | undefined } = {}
      ) {
        const before = DateTime.subtract(yield* DateTime.now, { days })
        const dropped = yield* db.delete(memories).where(and(
          isNull(memories.confirmedAt),
          lt(memories.createdAt, before),
          options.userId === undefined ? undefined : eq(memories.userId, options.userId as `user_${string}`)
        )).returning({ id: memories.id }).pipe(Effect.orDie)
        return dropped.length
      })

      return Memories.of({
        list,
        forPrompt,
        remember,
        learn,
        confirm,
        remove,
        discard: drop,
        removeAll,
        export: exportAll,
        dropStale
      })
    })
  )
}
