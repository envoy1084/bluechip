// The embedder when its provider is down: every request fails as a network error would, so callers fall back to
// full-text search and leave entries for the embed job.
import * as AiError from "effect/ai/AiError"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Embeddings } from "../../src/platform/embeddings/Embeddings.ts"

const down = AiError.make({
  module: "FailingEmbeddings",
  method: "embedMany",
  reason: new AiError.InternalProviderError({ description: "The embedder is down" })
})

export const FailingEmbeddings = Layer.succeed(
  Embeddings,
  Embeddings.of({
    model: "test-hashed-words",
    relevance: 0.2,
    documents: () => Effect.fail(down),
    query: () => Effect.fail(down)
  })
)
