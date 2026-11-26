import type * as AiError from "effect/ai/AiError"
import * as EmbeddingModel from "effect/ai/EmbeddingModel"
import * as Arr from "effect/Array"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as VoyageEmbeddingModel from "./VoyageEmbeddingModel.ts"

/** The vectors' size: the `vector(1024)` columns of recall entries and knowledge chunks. */
export const DIMENSIONS = 1024

// Voyage takes up to 1,000 texts a request; smaller batches keep each request well under its token limit.
const BATCH = 64

const embedAll = (model: EmbeddingModel.EmbeddingModel, texts: ReadonlyArray<string>) =>
  Effect.map(
    Effect.forEach(Arr.chunksOf(texts, BATCH), (batch) => model.embedMany(batch)),
    (responses) => responses.flatMap((response) => response.embeddings.map((embedding) => embedding.vector))
  )

/**
 * Turns text into vectors, for recall and knowledge: `documents` for what is stored, `query` for what is searched
 * with (models embed them differently). A port: the server runs Voyage, tests a deterministic embedder.
 */
export class Embeddings extends Context.Service<Embeddings, {
  /** The model's id, stored with every vector so a change of model re-embeds them. */
  readonly model: string
  /** The cosine similarity under which a vector match isn't relevant enough to count. */
  readonly relevance: number
  readonly documents: (
    texts: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<number>>, AiError.AiError>
  readonly query: (text: string) => Effect.Effect<ReadonlyArray<number>, AiError.AiError>
}>()("@bluechip/server/Embeddings") {
  /**
   * Voyage with `VOYAGE_API_KEY`: `EMBEDDING_MODEL` (default `voyage-4`) at 1,024 dimensions, on the `HttpClient`
   * given.
   */
  static readonly layerNoDeps = Layer.unwrap(Effect.gen(function*() {
    const apiKey = yield* Config.Redacted("VOYAGE_API_KEY")
    const model = yield* Config.String("EMBEDDING_MODEL").pipe(Config.withDefault("voyage-4"))

    return Layer.effect(
      Embeddings,
      Effect.gen(function*() {
        const embedding = yield* EmbeddingModel.EmbeddingModel
        return Embeddings.of({
          model,
          relevance: 0.35,
          documents: (texts) =>
            embedAll(embedding, texts).pipe(VoyageEmbeddingModel.withConfigOverride({ input_type: "document" })),
          query: (text) =>
            embedding.embed(text).pipe(
              Effect.map((response) => response.vector),
              VoyageEmbeddingModel.withConfigOverride({ input_type: "query" })
            )
        })
      })
    ).pipe(Layer.provide(VoyageEmbeddingModel.layer({ apiKey, model, dimensions: DIMENSIONS })))
  }))

  /** Voyage over `fetch`. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provide(FetchHttpClient.layer))

  /**
   * A deterministic embedder for tests and the browser suite, with no network: each word (lowercased, without common
   * words and plain suffixes) adds to a hashed dimension, and the vector is normalised. Texts that share words are
   * close, so retrieval behaves like a real model's on the words it is given.
   */
  static readonly layerTest = Layer.effect(
    Embeddings,
    Effect.gen(function*() {
      const embedding = yield* EmbeddingModel.make({
        embedMany: ({ inputs }) => Effect.succeed({ results: inputs.map(hashedVector), usage: { inputTokens: 0 } })
      })
      return Embeddings.of({
        model: "test-hashed-words",
        relevance: 0.2,
        documents: (texts) => embedAll(embedding, texts),
        query: (text) => Effect.map(embedding.embed(text), (response) => response.vector)
      })
    })
  )
}

const COMMON = new Set(
  "a an and are as at be but by do does did for from has have how i if in is it its me my of on or our so than that the their them then there they this to was we what when where which who why will with you your"
    .split(
      " "
    )
)

const stem = (word: string) => word.length > 4 ? word.replace(/(ing|ed|es|s)$/, "") : word

// FNV-1a, 32-bit.
const hash = (text: string) => {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193)
  return value >>> 0
}

const hashedVector = (text: string): Array<number> => {
  const vector = new Array<number>(DIMENSIONS).fill(0)
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !COMMON.has(word)).map(stem)
  for (const word of words) vector[hash(word) % DIMENSIONS]! += 1
  // An empty text still needs a direction: cosine distance is undefined for a zero vector.
  if (words.length === 0) vector[0] = 1
  const norm = Math.hypot(...vector)
  return vector.map((value) => value / norm)
}
