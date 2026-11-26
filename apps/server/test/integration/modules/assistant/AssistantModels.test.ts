import { assert, describe, layer } from "@effect/vitest"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import { AssistantModels } from "../../../../src/modules/assistant/AssistantModels.ts"
import { AnthropicTest } from "../../../utils/AnthropicTest.ts"

// A reply of Anthropic's Messages API, as it comes back.
const reply = (fields: Record<string, unknown>) => ({
  id: "msg_01",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  stop_sequence: null,
  usage: { input_tokens: 12, output_tokens: 3 },
  ...fields
})

// The API key is read when a model runs, so the tests' effects carry the config too.
const models = AssistantModels.layerNoDeps.pipe(
  Layer.provideMerge(AnthropicTest.layer),
  Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: "sk-ant-test" })))
)

layer(models)("AssistantModels", (it) => {
  describe("onConversation", () => {
    it.effect("a refusal whose stop_details lacks fallback_credit_token is tried again, and the next answer is used", () =>
      Effect.gen(function*() {
        const anthropic = yield* AnthropicTest
        const before = yield* anthropic.requests
        yield* anthropic.answer(
          reply({
            content: [],
            stop_reason: "refusal",
            stop_details: { type: "refusal", category: null, explanation: null, recommended_model: null }
          }),
          reply({ content: [{ type: "text", text: "Noted." }], stop_reason: "end_turn" })
        )

        const fiber = yield* (yield* AssistantModels).onConversation(
          Effect.map(
            LanguageModel.generateText({ prompt: "Remember that I like Nvidia." }),
            (response) => response.text
          )
        ).pipe(Effect.forkChild)
        yield* TestClock.adjust("2 seconds")
        const text = yield* Fiber.join(fiber)

        assert.deepStrictEqual([text, (yield* anthropic.requests) - before], ["Noted.", 2])
      }))

    it.effect("a reply that doesn't decode for another reason fails at once", () =>
      Effect.gen(function*() {
        const anthropic = yield* AnthropicTest
        const before = yield* anthropic.requests
        yield* anthropic.answer(reply({ content: [{ type: "text" }], stop_reason: "end_turn" }))

        const error = yield* (yield* AssistantModels).onConversation(
          LanguageModel.generateText({ prompt: "Remember that I like Nvidia." })
        ).pipe(Effect.flip)

        assert.deepStrictEqual([error.reason._tag, (yield* anthropic.requests) - before], ["InvalidResponseError", 1])
      }))
  })
})
