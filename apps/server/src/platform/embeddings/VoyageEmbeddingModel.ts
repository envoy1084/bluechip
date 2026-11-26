// Voyage AI's embeddings as an `effect/ai` `EmbeddingModel`, on Effect's `HttpClient` (shaped like
// `@effect/ai-openai`'s `OpenAiEmbeddingModel`): requests carry their options through `Config`, so a document and a
// query are embedded with their own `input_type` and never batched together.
import * as AiError from "effect/ai/AiError"
import * as EmbeddingModel from "effect/ai/EmbeddingModel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as HttpClient from "effect/http/HttpClient"
import type * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Schedule from "effect/Schedule"
import * as Schema from "effect/Schema"

/** Where Voyage answers. */
export const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"

/** A request's options: what the text is (`document` to store, `query` to search with). */
export class Config extends Context.Service<Config, {
  readonly input_type?: "document" | "query" | undefined
}>()("@bluechip/server/VoyageEmbeddingModel/Config") {}

const EmbeddingsResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ embedding: Schema.Array(Schema.Finite), index: Schema.Int })),
  usage: Schema.optional(Schema.Struct({ total_tokens: Schema.optional(Schema.Int) }))
})

const failure = (reason: AiError.AiErrorReason) =>
  AiError.make({ module: "VoyageEmbeddingModel", method: "embedMany", reason })

// What an HTTP failure means: the status's reason when Voyage answered, a network error when it didn't.
const fromHttpError = (error: HttpClientError.HttpClientError): AiError.AiError => {
  const reason = error.reason
  if (reason._tag === "StatusCodeError") {
    return failure(AiError.reasonFromHttpStatus({ status: reason.response.status }))
  }
  if (reason._tag === "DecodeError" || reason._tag === "EmptyBodyError") {
    return failure(new AiError.InvalidResponseError({ description: reason.description ?? reason._tag }))
  }
  return failure(AiError.NetworkError.fromHttpClientError(error as never))
}

/**
 * The model on `HttpClient`, with `apiKey`: retries Voyage's rate limits (429, waiting its `Retry-After`) and server
 * errors (5xx) three times, about half a second apart and doubling.
 */
export const make = Effect.fnUntraced(function*(options: {
  readonly apiKey: Redacted.Redacted<string>
  readonly model: string
  readonly dimensions: number
}) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.bearerToken(Redacted.value(options.apiKey))),
    HttpClient.retryTransient({
      schedule: Schedule.exponential("500 millis").pipe(Schedule.jittered),
      times: 3
    }),
    HttpClient.filterStatusOk
  )

  return yield* EmbeddingModel.make({
    batchKey: (context) => Context.getOrUndefined(context, Config)?.input_type,
    embedMany: Effect.fnUntraced(function*({ inputs }) {
      const config = yield* Effect.serviceOption(Config)
      const response = yield* HttpClientRequest.post(VOYAGE_URL).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          model: options.model,
          input: inputs,
          input_type: config._tag === "Some" ? config.value.input_type ?? null : null,
          output_dimension: options.dimensions,
          truncation: true
        }),
        client.execute,
        Effect.flatMap(HttpClientResponse.schemaBodyJson(EmbeddingsResponse)),
        Effect.catchTag("HttpClientError", (error) => Effect.fail(fromHttpError(error))),
        Effect.catchTag(
          "SchemaError",
          (error) => Effect.fail(failure(AiError.InvalidResponseError.fromSchemaError(error)))
        )
      )

      const results = new Array<Array<number>>(inputs.length)
      for (const entry of response.data) results[entry.index] = [...entry.embedding]
      if (response.data.length !== inputs.length || results.some((vector) => vector.length !== options.dimensions)) {
        return yield* failure(
          new AiError.InvalidOutputError({ description: `Voyage didn't return one vector per input` })
        )
      }
      return { results, usage: { inputTokens: response.usage?.total_tokens } }
    })
  })
})

/** The model as a layer, with its dimensions. */
export const layer = (options: {
  readonly apiKey: Redacted.Redacted<string>
  readonly model: string
  readonly dimensions: number
}): Layer.Layer<EmbeddingModel.EmbeddingModel | EmbeddingModel.Dimensions, never, HttpClient.HttpClient> =>
  Layer.merge(
    Layer.effect(EmbeddingModel.EmbeddingModel, make(options)),
    Layer.succeed(EmbeddingModel.Dimensions, options.dimensions)
  )

/** Runs `self` with these request options. */
export const withConfigOverride =
  (overrides: typeof Config.Service) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Config>> =>
    Effect.flatMap(
      Effect.serviceOption(Config),
      (config) => Effect.provideService(self, Config, { ...(config._tag === "Some" ? config.value : {}), ...overrides })
    )
