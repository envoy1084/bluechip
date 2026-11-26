import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { nvidiaStopLoss } from "../../fixtures/Automations.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The draft as the model writes it: amounts as strings of USDC units, percentages in basis points.
const weeklyApple = {
  name: "Weekly Apple",
  agentId: null,
  trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
  conditions: [],
  action: { type: "buy", config: { amount: "50000000", split: [{ symbol: "AAPL", weight: 10_000 }] } },
  settings: {
    cooldownMinutes: 60,
    maxFires: null,
    expiresAt: null,
    quietHours: null,
    marketHoursOnly: null,
    actDirectly: false
  }
}

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("the assistant's automations", (it) => {
  describe("createAutomation", () => {
    it.effect("\"Every Monday buy $50 of Apple\": a card reading it back, nothing saved until confirmed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const text = `Every Monday buy $50 of Apple ${randomUUID()}`
        yield* (yield* RecordedModel).record({
          to: text,
          rounds: [[{ call: "createAutomation", params: { draft: weeklyApple, automationId: null } }], [{
            text: "Confirm it on the card."
          }]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, text)
        const [card] = run.cards
        assert(card?._tag === "Automation")
        const before = yield* user.api.automations.list({ query: {} })
        const applied = yield* user.api.assistant.confirmCard({ params: { id: card.id } })
        const after = yield* user.api.automations.list({ query: {} })

        assert.deepStrictEqual(
          [
            card.status,
            card.description.sentence,
            before,
            applied._tag === "Automation" ? applied.status : applied._tag,
            after.map((automation) => [automation.createdBy, automation.description.sentence])
          ],
          [
            "pending",
            "Every Monday at 10:00 New York time, buy $50 of Apple.",
            [],
            "applied",
            [["assistant", "Every Monday at 10:00 New York time, buy $50 of Apple."]]
          ]
        )
      }))

    it.effect("\"make it 8%\": a card changing the saved automation, applied when confirmed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: nvidiaStopLoss(null) }
        })
        const text = `Make it 8% ${randomUUID()}`
        yield* (yield* RecordedModel).record({
          to: text,
          rounds: [[{
            call: "createAutomation",
            params: {
              automationId: saved.id,
              draft: {
                ...weeklyApple,
                name: "NVIDIA stop-loss",
                trigger: {
                  type: "priceMove",
                  config: { symbol: "NVDA", reference: "trailingHigh", bps: 800, direction: "down" }
                },
                action: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } }
              }
            }
          }], [{ text: "Confirm the change on the card." }]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, text)
        const [card] = run.cards
        assert(card?._tag === "Automation")
        yield* user.api.assistant.confirmCard({ params: { id: card.id } })
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual(
          [card.action, detail.automation.description.sentence],
          ["edit", "When NVIDIA falls 8% from its high, sell half your NVIDIA."]
        )
      }))

    it.effect("a draft with a problem: no card, the problem goes back to the model", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const text = `Split $50 across Apple and Nvidia ${randomUUID()}`
        const model = yield* RecordedModel
        yield* model.record({
          to: text,
          rounds: [[{
            call: "createAutomation",
            params: {
              automationId: null,
              draft: {
                ...weeklyApple,
                action: {
                  type: "buy",
                  config: {
                    amount: "50000000",
                    split: [{ symbol: "AAPL", weight: 5000 }, { symbol: "NVDA", weight: 4000 }]
                  }
                }
              }
            }
          }], [{ text: "The split has to add up to 100%." }]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, text)
        const [, second] = yield* model.prompts(text)

        assert.deepStrictEqual(run.cards, [])
        assert.include(JSON.stringify(second), "action.split: The split has to add up to 100%.")
      }))
  })

  describe("pauseAutomation", () => {
    it.effect("a card pausing an automation, applied when confirmed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: nvidiaStopLoss(null) }
        })
        const text = `Pause my stop-loss ${randomUUID()}`
        yield* (yield* RecordedModel).record({
          to: text,
          rounds: [[{ call: "pauseAutomation", params: { automationId: saved.id, resume: false } }], [{
            text: "Confirm on the card."
          }]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, text)
        const applied = yield* user.api.assistant.confirmCard({ params: { id: run.cards[0]!.id } })

        assert.deepStrictEqual(
          applied._tag === "AutomationControl" ? [applied.status, applied.automation?.status] : applied._tag,
          ["applied", "paused"]
        )
      }))
  })
})
