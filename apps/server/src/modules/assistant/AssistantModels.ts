import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import type * as AiError from "effect/ai/AiError"
import type * as LanguageModel from "effect/ai/LanguageModel"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as Layer from "effect/Layer"
import * as Predicate from "effect/Predicate"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"

// A failure worth another try: overloaded, rate limited, or the network. Invalid requests fail at once. Also a
// refusal @effect/ai-anthropic can't decode because Anthropic left `stop_details.fallback_credit_token` out of it
// (seen once on Sonnet, to report upstream): the next try answers.
const retryable = (error: unknown): boolean => {
  if (!Predicate.isTagged(error, "AiError")) return false
  const { reason } = error as AiError.AiError
  return reason.isRetryable ||
    (reason._tag === "InvalidResponseError" && reason.description.includes("fallback_credit_token"))
}

// Three tries in all, about half a second then a second apart, spread so retries from many runs don't line up.
const retries = Schedule.exponential("500 millis").pipe(Schedule.jittered, Schedule.upTo({ times: 2 }))

/**
 * The models the assistant runs on: the conversation model for the conversation and its memory notes, retried when it
 * fails for a reason worth retrying (never once it has streamed), and the small model for conversation titles. A
 * port: production runs Anthropic's models, tests recorded ones.
 */
export class AssistantModels extends Context.Service<AssistantModels, {
  /** The conversation model's id, as budgets price it. */
  readonly conversationModel: string
  readonly smallModel: string
  /** Streams on the conversation model. */
  readonly converse: <A, E, R>(
    stream: Stream.Stream<A, E, R>
  ) => Stream.Stream<A, E | AiError.AiError, Exclude<R, LanguageModel.LanguageModel>>
  /** Runs a side task on the conversation model (memory notes). */
  readonly onConversation: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | AiError.AiError, Exclude<R, LanguageModel.LanguageModel>>
  /** Runs a side task on the small model (titles). */
  readonly small: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | AiError.AiError, Exclude<R, LanguageModel.LanguageModel>>
}>()("@bluechip/server/AssistantModels") {
  /** The assistant on two language models. */
  static readonly make = (models: {
    readonly conversation: { readonly id: string; readonly layer: Layer.Layer<LanguageModel.LanguageModel> }
    readonly small: { readonly id: string; readonly layer: Layer.Layer<LanguageModel.LanguageModel> }
  }) =>
    AssistantModels.of({
      conversationModel: models.conversation.id,
      smallModel: models.small.id,
      converse: (stream) =>
        Stream.suspend(() => {
          // Once a part has reached the client, a retry would repeat it: only a stream that sent nothing is retried.
          let streamed = false
          return stream.pipe(
            Stream.tap(() => Effect.sync(() => (streamed = true))),
            Stream.retry(retries.pipe(Schedule.while(({ input }) => !streamed && retryable(input)))),
            Stream.provide(models.conversation.layer)
          )
        }) as never,
      onConversation: (effect) =>
        effect.pipe(
          Effect.retry(retries.pipe(Schedule.while(({ input }) => retryable(input)))),
          Effect.provide(models.conversation.layer)
        ) as never,
      small: (effect) => Effect.provide(effect, models.small.layer) as never
    })

  /**
   * Anthropic with `ANTHROPIC_API_KEY`: `ASSISTANT_MODEL` (default `claude-sonnet-5-5`) for conversations and memory
   * notes, `ASSISTANT_SMALL_MODEL` (default `claude-haiku-5-5`) for titles. Requests cache everything up to the newest
   * message (tools, system prompt and history), so each round of a turn reads the rest from the cache. Reaches
   * Anthropic with the `HttpClient` it is given (tests answer in process).
   */
  static readonly layerNoDeps = Layer.unwrap(Effect.gen(function*() {
    const conversation = yield* Config.String("ASSISTANT_MODEL").pipe(Config.withDefault("claude-sonnet-5-5"))
    const small = yield* Config.String("ASSISTANT_SMALL_MODEL").pipe(Config.withDefault("claude-haiku-5-5"))
    const httpClient = yield* HttpClient.HttpClient
    const client = AnthropicClient.layerConfig({ apiKey: Config.Redacted("ANTHROPIC_API_KEY") }).pipe(
      Layer.provide(Layer.succeed(HttpClient.HttpClient, httpClient))
    )

    // Only the tools marked `Tool.Strict` are strict: Anthropic allows 20 strict tools and 16 nullable or union
    // parameters across them in a request, and the toolkit has more. The rest are decoded against their schemas, and
    // a call that doesn't decode goes back to the model as a failure.
    const model = (id: string, config: Omit<typeof AnthropicLanguageModel.Config.Service, "model">) =>
      AnthropicLanguageModel.layer({ model: id, config: { ...config, strictJsonSchema: false } }).pipe(
        Layer.provide(client),
        Layer.orDie
      )

    return Layer.succeed(
      AssistantModels,
      AssistantModels.make({
        conversation: {
          id: conversation,
          layer: model(conversation, {
            max_tokens: 8000,
            cache_control: { type: "ephemeral" },
            output_config: { effort: "medium" }
          })
        },
        small: {
          id: small,
          layer: model(small, { max_tokens: 2000, cache_control: { type: "ephemeral" } })
        }
      })
    )
  }))
  /** `layerNoDeps` on the platform's `fetch`. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provide(FetchHttpClient.layer))
}
