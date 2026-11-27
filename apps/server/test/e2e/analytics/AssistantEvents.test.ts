import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AnalyticsTest } from "../../utils/AnalyticsTest.ts"
import { CONVERSATION_MODEL, RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestRecovery } from "../../utils/TestRecovery.ts"
import { TestTelegram } from "../../utils/TestTelegram.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`); analytics goes to memory (`AnalyticsTest`), with the text of
// prompts and answers off as on paper and production.
layer(
  Layer.mergeAll(TestAssistant.layerNoDeps, TestTelegram.layer, TestRecovery.layer),
  { excludeTestServices: true }
)("analytics: the assistant, Telegram and recovery", (it) => {
  describe("an assistant turn with a tool", () => {
    it.effect("conversation_started, message_sent, tool_called, and the turn's LLM analytics without text", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "How much do I have?",
          rounds: [[{ call: "getPortfolio", params: {} }], [{ text: "You have no money in bluechip yet." }]],
          usage: { input: 1000, output: 100 }
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "How much do I have?")
        const analytics = yield* AnalyticsTest
        const product = yield* analytics.told(user.id, "conversation_started", "message_sent", "tool_called")
        const generations = yield* analytics.told(user.id, "$ai_generation")
        const [span] = yield* analytics.told(user.id, "$ai_span")
        const [trace] = yield* analytics.told(user.id, "$ai_trace")
        const budget = yield* user.api.assistant.budget()

        assert.deepStrictEqual(
          product.map(({ event, properties: { $set: _, ...properties } }) => ({ event, properties })),
          [
            { event: "conversation_started", properties: { surface: "web", has_agent: false } },
            { event: "message_sent", properties: { surface: "web", conversation_id: conversation.id, turn_index: 1 } },
            {
              event: "tool_called",
              properties: { tool: "getPortfolio", risk: "read", outcome: "ok", conversation_id: conversation.id }
            }
          ]
        )
        const chat = generations.filter(({ properties }) => properties["$ai_span_name"] === "chat")
        assert.deepStrictEqual(
          chat.map(({ properties }) => [
            properties["$ai_trace_id"],
            properties["$ai_span_id"],
            properties["$ai_parent_id"],
            properties["$ai_session_id"],
            properties["$ai_model"],
            properties["$ai_provider"],
            properties["$ai_input_tokens"],
            properties["$ai_output_tokens"],
            properties["$ai_stop_reason"],
            properties["$ai_tools"],
            properties["$ai_is_error"]
          ]),
          [
            [
              run.runId,
              `${run.runId}:round-1`,
              run.runId,
              conversation.id,
              CONVERSATION_MODEL,
              "anthropic",
              1000,
              100,
              "tool-calls",
              ["getPortfolio"],
              false
            ],
            [
              run.runId,
              `${run.runId}:round-2`,
              run.runId,
              conversation.id,
              CONVERSATION_MODEL,
              "anthropic",
              1000,
              100,
              "stop",
              [],
              false
            ]
          ]
        )
        assert.deepStrictEqual(
          [...new Set(generations.map(({ properties }) => properties["$ai_span_name"]))].sort(),
          ["chat", "memory", "title"]
        )
        assert.closeTo(
          generations.reduce((sum, { properties }) => sum + (properties["$ai_total_cost_usd"] as number), 0),
          budget.costMicros / 1_000_000,
          1e-9
        )
        assert.deepStrictEqual(
          [span?.properties["$ai_span_name"], span?.properties["$ai_parent_id"], span?.properties["$ai_is_error"]],
          ["getPortfolio", `${run.runId}:round-1`, false]
        )
        assert.deepStrictEqual(
          [trace?.properties["$ai_trace_id"], trace?.properties["rounds"], trace?.properties["$ai_is_error"]],
          [run.runId, 2, false]
        )
        assert.deepStrictEqual(
          generations.filter(({ properties }) => "$ai_input" in properties || "$ai_output_choices" in properties),
          []
        )
      }))
  })

  describe("Telegram", () => {
    it.effect("a chat linked with its code: telegram_linked, and the person marked linked", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        yield* (yield* TestTelegram).linked(user)
        const told = yield* (yield* AnalyticsTest).told(user.id, "telegram_linked")

        assert.deepStrictEqual(told, [
          { event: "telegram_linked", properties: { $set: { network: "local", telegram_linked: true } } }
        ])
      }))
  })

  describe("recovery", () => {
    it.effect("a recovery key set up, then a recovery asked for: recovery_key_added, then recovery_started", () =>
      Effect.gen(function*() {
        const recovery = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded

        yield* recovery.request(user, yield* recovery.setUp(user))
        const told = yield* (yield* AnalyticsTest).told(user.id, "recovery_key_added", "recovery_started")

        assert.deepStrictEqual(told, [
          {
            event: "recovery_key_added",
            properties: { by: "device", $set: { network: "local", has_recovery_passkey: true } }
          },
          { event: "recovery_started", properties: { by: "device", $set: { network: "local" } } }
        ])
      }))
  })
})
