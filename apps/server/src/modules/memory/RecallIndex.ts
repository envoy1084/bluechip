import type { RecallKind } from "@bluechip/domain/assistant/Recall"
import type { AgentId, ConversationId, UserId } from "@bluechip/domain/Ids"
import { and, eq, isNull, ne, or } from "drizzle-orm"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { Embeddings } from "../../platform/embeddings/Embeddings.ts"
import { count, EmbeddingsCalls } from "../../platform/telemetry/Metrics.ts"
import { Analytics } from "../analytics/Analytics.ts"
import { recallEntries } from "./tables.ts"

/** Something recallable, from the record it comes from (whose id `sourceId` is). */
interface RecallSource {
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
  /**
   * Writes the sources' entries and embeds them; with `background`, the embedding runs on its own fiber, for writers
   * on a path that mustn't wait for the embedder (an intent moving on).
   */
  readonly index: (
    sources: ReadonlyArray<RecallSource>,
    options?: { readonly background?: boolean | undefined }
  ) => Effect.Effect<void>
  /**
   * Embeds entries without a vector of the current model (everyone's, the job; or one user's); returns how many it
   * embedded.
   */
  readonly embedPending: (options?: { readonly userId?: UserId | undefined }) => Effect.Effect<number>
}>()("@bluechip/server/RecallIndex") {
  static readonly layer = Layer.effect(
    RecallIndex,
    Effect.gen(function*() {
      const db = yield* Database
      const embeddings = yield* Embeddings
      const scope = yield* Effect.scope
      const analytics = yield* Analytics

      // Embeds rows by id, keeping only vectors for text that didn't change meanwhile. Each call is told to LLM
      // analytics, about the user whose rows it embeds (`null`: the job's, several users' rows).
      const embed = Effect.fnUntraced(function*(
        rows: ReadonlyArray<{ readonly id: string; readonly text: string }>,
        userId: UserId | null
      ) {
        if (rows.length === 0) return 0
        const startedAt = yield* Clock.currentTimeMillis
        const told = Effect.fnUntraced(function*(failed: boolean) {
          const span = yield* Effect.option(Effect.currentSpan)
          const spanId = Option.isSome(span) ? span.value.spanId : rows[0]!.id
          yield* analytics.capture(userId, {
            _tag: "$ai_embedding",
            $ai_trace_id: Option.isSome(span) ? span.value.traceId : spanId,
            $ai_span_id: spanId,
            $ai_span_name: "recall",
            $ai_model: embeddings.model,
            $ai_provider: "voyage",
            inputs: rows.length,
            $ai_latency: ((yield* Clock.currentTimeMillis) - startedAt) / 1000,
            $ai_is_error: failed
          }, { id: `${spanId}:${rows[0]!.id}` })
        })
        const vectors = yield* embeddings.documents(rows.map((row) => row.text)).pipe(
          Effect.tapError(() =>
            Effect.andThen(count(EmbeddingsCalls, { model: embeddings.model, outcome: "error" }), told(true))
          ),
          Effect.tap(() =>
            Effect.andThen(count(EmbeddingsCalls, { model: embeddings.model, outcome: "ok" }), told(false))
          )
        )
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

      const index = Effect.fn("RecallIndex.index")(function*(
        sources: ReadonlyArray<RecallSource>,
        options: { readonly background?: boolean | undefined } = {}
      ) {
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

        // One user's sources, as every writer gives them.
        const embedded = embed(written, sources[0]?.userId ?? null).pipe(
          Effect.catchTag("AiError", (error) => Effect.logWarning("Embedding recall entries failed", error))
        )
        if (options.background === true) yield* Effect.forkIn(embedded, scope)
        else yield* embedded
      })

      const embedPending = Effect.fn("RecallIndex.embedPending")(function*(
        options: { readonly userId?: UserId | undefined } = {}
      ) {
        const rows = yield* db.select({ id: recallEntries.id, text: recallEntries.text }).from(recallEntries)
          .where(and(
            or(isNull(recallEntries.model), ne(recallEntries.model, embeddings.model)),
            options.userId === undefined ? undefined : eq(recallEntries.userId, options.userId as `user_${string}`)
          )).limit(EMBED_RUN).pipe(Effect.orDie)
        return yield* embed(rows, options.userId ?? null)
      }, (effect) =>
        effect.pipe(
          Effect.catchTag("AiError", (error) => Effect.as(Effect.logWarning("The recall embed job failed", error), 0))
        ))

      return RecallIndex.of({ index, embedPending })
    })
  )
}
