import type { RecallKind } from "@bluechip/domain/assistant/Recall"
import type { AgentId, ConversationId, UserId } from "@bluechip/domain/Ids"
import { and, eq, isNull, ne, or } from "drizzle-orm"
import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { Embeddings } from "../../platform/embeddings/Embeddings.ts"
import { recallEntries } from "./tables.ts"

/** Something recallable, from the record it comes from (whose id `sourceId` is). */
export interface RecallSource {
  readonly kind: RecallKind
  readonly sourceId: string
  readonly userId: UserId
  readonly agentId: AgentId | null
  readonly conversationId: ConversationId | null
  readonly text: string
  readonly importance: number
  readonly at: DateTime.Utc
}

// The column that ties an entry to its source, so deleting the source deletes the entry.
const sourceColumn = {
  memory: recallEntries.memoryId,
  message: recallEntries.messageId,
  summary: recallEntries.summaryId,
  journal: recallEntries.journalId
} as const

// The most rows the embed job embeds in one run.
const EMBED_RUN = 512

/**
 * Keeps the recall entries: `index` writes an entry per source (replacing the one it had) and embeds it there and
 * then, best effort; an entry whose embedding failed is searched by its words until `embedPending` (the embed job)
 * embeds it, which also re-embeds entries another model made.
 */
export class RecallIndex extends Context.Service<RecallIndex, {
  readonly index: (sources: ReadonlyArray<RecallSource>) => Effect.Effect<void>
  /** Embeds entries without a vector of the current model; returns how many it embedded. */
  readonly embedPending: Effect.Effect<number>
}>()("@bluechip/server/RecallIndex") {
  static readonly layer = Layer.effect(
    RecallIndex,
    Effect.gen(function*() {
      const db = yield* Database
      const embeddings = yield* Embeddings

      // Embeds rows by id, keeping only vectors for text that didn't change meanwhile.
      const embed = Effect.fnUntraced(function*(rows: ReadonlyArray<{ readonly id: string; readonly text: string }>) {
        if (rows.length === 0) return 0
        const vectors = yield* embeddings.documents(rows.map((row) => row.text))
        yield* Effect.forEach(
          rows,
          (row, index) =>
            db.update(recallEntries).set({ embedding: [...vectors[index]!], model: embeddings.model })
              .where(and(eq(recallEntries.id, row.id as `recall_${string}`), eq(recallEntries.text, row.text))),
          {
            concurrency: 8,
            discard: true
          }
        ).pipe(Effect.orDie)
        return rows.length
      })

      const index = Effect.fn("RecallIndex.index")(function*(sources: ReadonlyArray<RecallSource>) {
        const written: Array<{ readonly id: string; readonly text: string }> = []
        for (const source of sources) {
          const text = source.text.trim()
          if (text.length === 0) continue
          const values = {
            userId: source.userId as `user_${string}`,
            agentId: source.agentId as `agent_${string}` | null,
            conversationId: source.conversationId as `conversation_${string}` | null,
            text,
            importance: source.importance,
            at: source.at,
            model: null,
            embedding: null
          }
          const [row] = yield* db.insert(recallEntries).values({
            ...values,
            id: typeid("recall").toString() as `recall_${string}`,
            kind: source.kind,
            [`${source.kind}Id` as const]: source.sourceId
          }).onConflictDoUpdate({ target: sourceColumn[source.kind], set: values }).returning({
            id: recallEntries.id,
            text: recallEntries.text
          }).pipe(Effect.orDie)
          written.push(row!)
        }

        yield* embed(written).pipe(
          Effect.catchTag("AiError", (error) => Effect.logWarning("Embedding recall entries failed", error))
        )
      })

      const embedPending = Effect.gen(function*() {
        const rows = yield* db.select({ id: recallEntries.id, text: recallEntries.text }).from(recallEntries)
          .where(or(isNull(recallEntries.model), ne(recallEntries.model, embeddings.model))).limit(EMBED_RUN)
          .pipe(Effect.orDie)
        return yield* embed(rows)
      }).pipe(
        Effect.catchTag("AiError", (error) => Effect.as(Effect.logWarning("The recall embed job failed", error), 0)),
        Effect.withSpan("RecallIndex.embedPending")
      )

      return RecallIndex.of({ index, embedPending })
    })
  )
}
