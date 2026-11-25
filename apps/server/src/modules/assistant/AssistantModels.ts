import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import type * as AiError from "effect/ai/AiError"
import type * as LanguageModel from "effect/ai/LanguageModel"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as ExecutionPlan from "effect/ExecutionPlan"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

/**
 * The models the assistant runs on: the conversation model (falling back to the small one when it fails before
 * streaming anything) and the small model for side tasks (titles, memory extraction). A port: production runs
 * Anthropic's models, tests a recorded model.
 */
export class AssistantModels extends Context.Service<AssistantModels, {
  /** The conversation model's id, as budgets price it. */
  readonly conversationModel: string
  readonly smallModel: string
  readonly converse: <A, E, R>(
    stream: Stream.Stream<A, E, R>
  ) => Stream.Stream<A, E | AiError.AiError, Exclude<R, LanguageModel.LanguageModel>>
  readonly small: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | AiError.AiError, Exclude<R, LanguageModel.LanguageModel>>
}>()("@bluechip/server/AssistantModels") {
  /** The assistant on two language models: two tries of the conversation model, then one of the small one. */
  static readonly make = (models: {
    readonly conversation: { readonly id: string; readonly layer: Layer.Layer<LanguageModel.LanguageModel> }
    readonly small: { readonly id: string; readonly layer: Layer.Layer<LanguageModel.LanguageModel> }
  }) => {
    const plan = ExecutionPlan.make(
      { provide: models.conversation.layer, attempts: 2 },
      { provide: models.small.layer, attempts: 1 }
    )
    return AssistantModels.of({
      conversationModel: models.conversation.id,
      smallModel: models.small.id,
      converse: (stream) =>
        stream.pipe(Stream.withExecutionPlan(plan, { preventFallbackOnPartialStream: true })) as never,
      small: (effect) => Effect.provide(effect, models.small.layer) as never
    })
  }

  /**
   * Anthropic with `ANTHROPIC_API_KEY`: `ASSISTANT_MODEL` (default `claude-sonnet-5-5`) for conversations and
   * `ASSISTANT_SMALL_MODEL` (default `claude-haiku-5-5`) for side tasks. Requests cache everything up to the newest
   * message (tools, system prompt and history), so each round of a turn reads the rest from the cache.
   */
  static readonly layer = Layer.unwrap(Effect.gen(function*() {
    const conversation = yield* Config.String("ASSISTANT_MODEL").pipe(Config.withDefault("claude-sonnet-5-5"))
    const small = yield* Config.String("ASSISTANT_SMALL_MODEL").pipe(Config.withDefault("claude-haiku-5-5"))
    const client = AnthropicClient.layerConfig({ apiKey: Config.Redacted("ANTHROPIC_API_KEY") }).pipe(
      Layer.provide(FetchHttpClient.layer)
    )

    const model = (id: string, config: Omit<typeof AnthropicLanguageModel.Config.Service, "model">) =>
      AnthropicLanguageModel.layer({ model: id, config }).pipe(Layer.provide(client), Layer.orDie)

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
          layer: model(small, {
            max_tokens: 2000,
            cache_control: { type: "ephemeral" },
            output_config: { effort: "low" }
          })
        }
      })
    )
  }))
}
