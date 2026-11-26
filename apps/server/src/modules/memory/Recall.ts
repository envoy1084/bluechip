import { fuseRanks, RecallHit, type RecallKind, weigh } from "@bluechip/domain/assistant/Recall"
import type { AgentId, ConversationId } from "@bluechip/domain/Ids"
import { and, cosineDistance, desc, eq, inArray, isNotNull, isNull, ne, or, type SQL, sql } from "drizzle-orm"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Database } from "../../platform/db/Database.ts"
import { Embeddings } from "../../platform/embeddings/Embeddings.ts"
import type { Owner } from "../signing/SigningRequests.ts"
import { memories, recallEntries } from "./tables.ts"

/** What to recall for. */
export interface RecallQuery {
  readonly text: string
  /** Every kind when absent. */
  readonly kinds?: ReadonlyArray<RecallKind> | undefined
  /** Only entries about this agent or about no agent (a conversation about the agent). */
  readonly agentId?: AgentId | null | undefined
  /** Leaves out the messages and summary of this conversation (the prompt has them already). */
  readonly excludeConversation?: ConversationId | undefined
  /** Memories still waiting for the user are found too (the memory page); never for prompts or tools. */
  readonly includeUnconfirmed?: boolean | undefined
  readonly limit?: number | undefined
}

// How many each search (words, meaning) brings before they are fused.
const CANDIDATES = 24

const DAY_MS = 86_400_000

/**
 * Recalls for a user: full-text and vector search over their recall entries, fused by reciprocal rank and weighed by
 * importance and recency (since made, or since a memory was last used). Every query is filtered by the user first; a
 * failed query embedding leaves the words to find what they can.
 */
export class Recall extends Context.Service<Recall, {
  readonly search: (owner: Owner, query: RecallQuery) => Effect.Effect<ReadonlyArray<RecallHit>>
}>()("@bluechip/server/Recall") {
  static readonly layer = Layer.effect(
    Recall,
    Effect.gen(function*() {
      const db = yield* Database
      const embeddings = yield* Embeddings

      const columns = {
        id: recallEntries.id,
        kind: recallEntries.kind,
        memoryId: recallEntries.memoryId,
        messageId: recallEntries.messageId,
        summaryId: recallEntries.summaryId,
        journalId: recallEntries.journalId,
        agentId: recallEntries.agentId,
        text: recallEntries.text,
        importance: recallEntries.importance,
        at: recallEntries.at,
        lastUsedAt: memories.lastUsedAt
      }
      type Candidate = {
        readonly id: string
        readonly kind: RecallKind
        readonly memoryId: string | null
        readonly messageId: string | null
        readonly summaryId: string | null
        readonly journalId: string | null
        readonly agentId: string | null
        readonly text: string
        readonly importance: number
        readonly at: DateTime.Utc
        readonly lastUsedAt: DateTime.Utc | null
      }

      const scope = (owner: Owner, query: RecallQuery): SQL | undefined =>
        and(
          eq(recallEntries.userId, owner.id as `user_${string}`),
          query.kinds === undefined ? undefined : inArray(recallEntries.kind, [...query.kinds]),
          query.agentId === undefined || query.agentId === null ?
            undefined :
            or(isNull(recallEntries.agentId), eq(recallEntries.agentId, query.agentId as `agent_${string}`)),
          query.excludeConversation === undefined ?
            undefined :
            or(
              isNull(recallEntries.conversationId),
              ne(recallEntries.conversationId, query.excludeConversation as `conversation_${string}`)
            ),
          query.includeUnconfirmed === true ?
            undefined :
            or(ne(recallEntries.kind, "memory"), isNotNull(memories.confirmedAt))
        )

      const byWords = Effect.fnUntraced(function*(owner: Owner, query: RecallQuery) {
        const words = [...new Set(query.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])].slice(0, 32)
        if (words.length === 0) return [] as ReadonlyArray<Candidate>
        const matches = sql`to_tsquery('english', ${words.join(" | ")})`
        return yield* db.select(columns).from(recallEntries)
          .leftJoin(memories, eq(memories.id, recallEntries.memoryId))
          .where(and(scope(owner, query), sql`${recallEntries.textSearch} @@ ${matches}`))
          .orderBy(desc(sql`ts_rank_cd(${recallEntries.textSearch}, ${matches})`), desc(recallEntries.at))
          .limit(CANDIDATES).pipe(Effect.orDie) as Effect.Effect<ReadonlyArray<Candidate>>
      })

      const byMeaning = Effect.fnUntraced(function*(owner: Owner, query: RecallQuery) {
        const vector = yield* embeddings.query(query.text)
        const distance = cosineDistance(recallEntries.embedding, [...vector])
        // HNSW filters after its scan: iterative scans keep going until enough of this user's entries are found.
        return yield* db.transaction((tx) =>
          Effect.gen(function*() {
            yield* tx.execute(sql`set local hnsw.iterative_scan = relaxed_order`)
            return yield* tx.select(columns).from(recallEntries)
              .leftJoin(memories, eq(memories.id, recallEntries.memoryId))
              .where(and(
                scope(owner, query),
                eq(recallEntries.model, embeddings.model),
                sql`${distance} <= ${1 - embeddings.relevance}`
              ))
              .orderBy(distance).limit(CANDIDATES)
          })
        ).pipe(Effect.orDie) as Effect.Effect<ReadonlyArray<Candidate>>
      }, (effect) =>
        effect.pipe(
          Effect.catchTag("AiError", (error) =>
            Effect.as(Effect.logWarning("Embedding a recall query failed", error), [] as ReadonlyArray<Candidate>))
        ))

      const search = Effect.fn("Recall.search")(function*(owner: Owner, query: RecallQuery) {
        if (query.text.trim().length === 0) return []
        const [words, meaning] = yield* Effect.all([byWords(owner, query), byMeaning(owner, query)], {
          concurrency: 2
        })
        const now = yield* DateTime.now

        const candidates = new Map([...words, ...meaning].map((row) => [row.id, row]))
        const fused = fuseRanks([words.map((row) => row.id), meaning.map((row) => row.id)])
        return [...candidates.values()].map((row) => {
          const seen = row.lastUsedAt === null || DateTime.isLessThan(row.lastUsedAt, row.at) ? row.at : row.lastUsedAt
          return new RecallHit({
            kind: row.kind,
            sourceId: (row.memoryId ?? row.messageId ?? row.summaryId ?? row.journalId)!,
            agentId: row.agentId as AgentId | null,
            text: row.text,
            at: row.at,
            score: weigh({
              fused: fused.get(row.id) ?? 0,
              importance: row.importance,
              ageDays: (now.epochMilliseconds - seen.epochMilliseconds) / DAY_MS
            })
          })
        }).sort((a, b) => b.score - a.score).slice(0, query.limit ?? 10)
      })

      return Recall.of({ search })
    })
  )
}
