import { Message } from "@bluechip/domain/assistant/Conversation"
import { MessageId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Prompt from "effect/ai/Prompt"
import * as ConfigProvider from "effect/ConfigProvider"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as TestClock from "effect/testing/TestClock"
import { AssistantModels } from "../../../../src/modules/assistant/AssistantModels.ts"
import { promptOf } from "../../../../src/modules/assistant/Transcript.ts"
import { AnthropicTest } from "../../../utils/AnthropicTest.ts"

const AT = DateTime.makeUnsafe("2026-11-26T10:00:00Z")

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

  describe("a conversation's next turn, as Anthropic receives it", () => {
    it.effect("the instructions alone as the cached system prompt, each turn's context after its message, and the first turn's thinking with its signature", () =>
      Effect.gen(function*() {
        const anthropic = yield* AnthropicTest
        const before = (yield* anthropic.bodies).length
        yield* anthropic.answer(reply({ content: [{ type: "text", text: "Any time." }], stop_reason: "end_turn" }))
        const prompt = Prompt.concat(
          Prompt.make([{
            role: "system",
            content: "You are bluechip's assistant.",
            options: { anthropic: { cacheControl: { type: "ephemeral" } } }
          }]),
          promptOf([
            new Message({
              id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3w"),
              role: "user",
              parts: [{ type: "text", text: "Which agents do I have?" }],
              model: null,
              createdAt: AT
            }),
            new Message({
              id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3x"),
              role: "assistant",
              parts: [
                {
                  type: "reasoning",
                  text: "None yet.",
                  options: { anthropic: { info: { type: "thinking", signature: "sig-1" } } }
                },
                { type: "text", text: "None yet." }
              ],
              model: "claude-sonnet-5-5",
              createdAt: AT
            }),
            new Message({
              id: MessageId.make("message_01jd8v4t5m6n7a8q9r0s1t2v3y"),
              role: "user",
              parts: [{ type: "text", text: "Thanks" }],
              model: null,
              createdAt: AT
            })
          ], {
            contexts: new Map([
              ["message_01jd8v4t5m6n7a8q9r0s1t2v3w", "## Today\n2026-11-25 (UTC)"],
              ["message_01jd8v4t5m6n7a8q9r0s1t2v3y", "## Today\n2026-11-26 (UTC)"]
            ])
          })
        )

        yield* (yield* AssistantModels).onConversation(LanguageModel.generateText({ prompt }))
        const [body] = (yield* anthropic.bodies).slice(before) as ReadonlyArray<{
          readonly system: unknown
          readonly messages: unknown
        }>

        assert.deepStrictEqual([body!.system, body!.messages], [
          [{ type: "text", text: "You are bluechip's assistant.", cache_control: { type: "ephemeral" } }],
          [
            { role: "user", content: [{ type: "text", text: "Which agents do I have?", cache_control: null }] },
            { role: "system", content: [{ type: "text", text: "## Today\n2026-11-25 (UTC)", cache_control: null }] },
            {
              role: "assistant",
              content: [
                { type: "thinking", thinking: "None yet.", signature: "sig-1" },
                { type: "text", text: "None yet." }
              ]
            },
            { role: "user", content: [{ type: "text", text: "Thanks", cache_control: null }] },
            { role: "system", content: [{ type: "text", text: "## Today\n2026-11-26 (UTC)", cache_control: null }] }
          ]
        ])
      }))
  })
})
