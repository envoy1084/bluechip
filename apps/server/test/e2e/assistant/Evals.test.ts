// The assistant's evals on recorded conversations: the tools each turn calls, the cards it shows, and that nothing
// it says sends money by itself.
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { appendFileSync } from "node:fs"
import { EVALS } from "../../fixtures/assistant/Evals.ts"
import { RecordedModel, recordEvalsTo } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "assistant evals",
  (it) => {
    describe("a recorded turn", () => {
      it.effect.each(EVALS.filter((entry) => recordEvalsTo === undefined || entry.written !== true))(
        "$name",
        (expected) =>
          Effect.gen(function*() {
            const { agent, user } = yield* (yield* TestAgents).locked
            const assistant = yield* TestAssistant
            const reply = expected.reply(agent.id)
            yield* (yield* RecordedModel).record(reply)
            const conversation = yield* assistant.start(user, expected.focused === true ? agent.id : undefined)

            const run = yield* assistant.ask(user, conversation.id, reply.to)
            const outcome = {
              calls: run.events.flatMap((event) => event.type === "TOOL_CALL_START" ? [event.toolCallName] : []),
              cards: run.cards.map((card) =>
                card._tag === "Trade"
                  ? `Trade:${card.intent.status}`
                  : "status" in card
                  ? `${card._tag}:${card.status}`
                  : card._tag
              )
            }

            if (recordEvalsTo !== undefined) {
              // The live model's rounds, rebuilt from what the client saw (each round starts a step), for `Evals.ts`.
              const rounds: Array<Array<{ text: string } | { call: string; args: string }>> = []
              const steps = new Map<string, { text: string } | { call: string; args: string }>()
              for (const event of run.events) {
                if (event.type === "STEP_STARTED" || rounds.length === 0) {
                  rounds.push([])
                  steps.clear()
                }
                const round = rounds[rounds.length - 1]!
                if (event.type === "TEXT_MESSAGE_CONTENT") {
                  const step = steps.get(event.messageId) ?? { text: "" }
                  if (!steps.has(event.messageId)) round.push(step)
                  steps.set(event.messageId, step)
                  if ("text" in step) step.text += event.delta
                } else if (event.type === "TOOL_CALL_START") {
                  const step = { call: event.toolCallName, args: "" }
                  steps.set(event.toolCallId, step)
                  round.push(step)
                } else if (event.type === "TOOL_CALL_ARGS") {
                  const step = steps.get(event.toolCallId)
                  if (step !== undefined && "args" in step) step.args += event.delta
                }
              }
              const recorded = rounds.filter((round) => round.length > 0).map((round) =>
                round.map((step) => "text" in step ? step : { call: step.call, params: JSON.parse(step.args || "{}") })
              )
              appendFileSync(
                recordEvalsTo,
                JSON.stringify({ name: expected.name, rounds: recorded, ...outcome }) + "\n"
              )
              return
            }

            assert.deepStrictEqual(outcome, { calls: expected.calls, cards: expected.cards })
          })
      )
    })
  }
)
