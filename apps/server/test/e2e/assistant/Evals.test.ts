// The assistant's evals on recorded conversations: the tools each turn calls, the cards it shows, and that nothing
// it says sends money by itself.
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { EVALS } from "../../fixtures/assistant/Evals.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "assistant evals",
  (it) => {
    describe("a recorded turn", () => {
      it.effect.each(EVALS)("$name", (expected) =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          const reply = expected.reply(agent.id)
          yield* (yield* RecordedModel).record(reply)
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, reply.to)

          assert.deepStrictEqual(
            {
              calls: run.events.flatMap((event) => event.type === "TOOL_CALL_START" ? [event.toolCallName] : []),
              cards: run.cards.map((card) =>
                card._tag === "Trade"
                  ? `Trade:${card.intent.status}`
                  : "status" in card
                  ? `${card._tag}:${card.status}`
                  : card._tag
              )
            },
            { calls: expected.calls, cards: expected.cards }
          )
        }))
    })
  }
)
