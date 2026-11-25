import { Conflict } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "assistant cards",
  (it) => {
    describe("a configure tool", () => {
      it.effect("shows a pending card and changes nothing; the run waits for it as an interrupt", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Pause my picker",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Pause my picker")
          const [card] = run.cards
          assert(card?._tag === "AgentControl")
          const now = yield* user.api.agents.agent({ params: { id: agent.id } })
          const last = run.events.at(-1)

          assert.deepStrictEqual(
            [card.status, now.paused, last?.type === "RUN_FINISHED" ? last.outcome : undefined],
            ["pending", false, {
              type: "interrupt",
              interrupts: [{
                id: card.id,
                reason: "confirmation",
                message: "Shown as a card. Nothing changes until the user confirms it on the card."
              }]
            }]
          )
        }))
    })

    describe("POST /api/assistant/cards/:id/confirm", () => {
      it.effect("applies the card: the agent is paused, and the card says so in the conversation", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Pause it please",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Pause it please")

          const applied = yield* user.api.assistant.confirmCard({ params: { id: run.cards[0]!.id } })
          const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })
          const shown = thread.messages.flatMap((message) =>
            message.parts.flatMap((part) => part.type === "card" ? [part.card] : [])
          )

          assert.deepStrictEqual(
            [
              applied._tag === "AgentControl" ? [applied.status, applied.agents.map((a) => a.paused)] : applied._tag,
              shown.map((card) => "status" in card ? card.status : card._tag)
            ],
            [["applied", [true]], ["applied"]]
          )
        }))

      it.effect("409: a card already confirmed", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Pause the picker twice",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Pause the picker twice")
          const id = run.cards[0]!.id
          yield* user.api.assistant.confirmCard({ params: { id } })

          const error = yield* user.api.assistant.confirmCard({ params: { id } }).pipe(Effect.flip)

          assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "cardClosed" }) })
        }))

      it.effect("saves a template once confirmed", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Save my picker's policies as Steady",
            rounds: [
              [{ call: "saveTemplate", params: { name: "Steady", agentId: agent.id, draft: null } }],
              [{ text: "Confirm on the card to save it." }]
            ]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Save my picker's policies as Steady")
          const before = yield* user.api.policies.templates()

          yield* user.api.assistant.confirmCard({ params: { id: run.cards[0]!.id } })
          const after = yield* user.api.policies.templates()

          assert.deepStrictEqual(
            [before.saved.length, after.saved.map((template) => [template.name, template.spec])],
            [0, [["Steady", agent.spec]]]
          )
        }))
    })

    describe("POST /api/assistant/cards/:id/dismiss", () => {
      it.effect("dismisses the card: the agent keeps trading", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Maybe pause my picker",
            rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Maybe pause my picker")

          const dismissed = yield* user.api.assistant.dismissCard({ params: { id: run.cards[0]!.id } })
          const now = yield* user.api.agents.agent({ params: { id: agent.id } })

          assert.deepStrictEqual(["status" in dismissed ? dismissed.status : undefined, now.paused], [
            "dismissed",
            false
          ])
        }))
    })

    describe("POST /api/assistant/run with resume", () => {
      it.effect("a resolved answer confirms the card before the turn, and the model reads it as applied", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          const recorded = yield* RecordedModel
          yield* recorded.record(
            {
              to: "Pause the picker for me",
              rounds: [[{ call: "pauseAgent", params: { agentId: agent.id } }], [{ text: "Confirm on the card." }]]
            },
            { to: "Done, is it paused?", rounds: [[{ text: "Yes, it's paused." }]] }
          )
          const conversation = yield* assistant.start(user)
          const first = yield* assistant.ask(user, conversation.id, "Pause the picker for me")

          yield* assistant.ask(user, conversation.id, "Done, is it paused?", {
            resume: [{ interruptId: first.cards[0]!.id, status: "resolved" }]
          })
          const now = yield* user.api.agents.agent({ params: { id: agent.id } })
          const [prompt] = yield* recorded.prompts("Done, is it paused?")
          const toolResults = prompt!.content.flatMap((message) =>
            message.role === "tool" ?
              message.content.flatMap((part) =>
                part.type === "tool-result"
                  ? (part.modelOutput ?? []).map((output) => output.type === "text" ? output.text : "")
                  : []
              ) :
              []
          )

          assert.deepStrictEqual([now.paused, toolResults], [true, ["The card is applied."]])
        }))
    })
  }
)
