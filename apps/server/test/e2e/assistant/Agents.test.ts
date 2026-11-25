import { checkSpec } from "@bluechip/domain/policies/Catalog"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "assistant agents",
  (it) => {
    describe("draftAgent", () => {
      it.effect("drafts an agent mixing policies, with a spec that passes the catalog's check, left a draft", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Make me a careful Nvidia buyer that asks above $40",
            rounds: [
              [{
                call: "draftAgent",
                params: {
                  name: "Careful Nvidia",
                  draft: {
                    template: "weeklyBuyer",
                    preset: "conservative",
                    stocks: ["NVDA"],
                    changes: { settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 40 }] }
                  }
                }
              }],
              [{ text: "Here's your draft; approve it with Face ID to lock it." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Make me a careful Nvidia buyer that asks above $40")
          const [card] = run.cards
          assert(card?._tag === "DraftAgent")
          const agent = yield* user.api.agents.agent({ params: { id: card.agent.id } })

          assert.deepStrictEqual(
            [agent.status, agent.template, checkSpec(card.agent.spec), card.request.action],
            ["draft", "weeklyBuyer", [], "lock"]
          )
        }))

      it.effect("only the user's Face ID locks the draft", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Draft an Apple picker",
            rounds: [
              [{
                call: "draftAgent",
                params: {
                  name: "Apple picker",
                  draft: { template: "stockPicker", preset: "balanced", stocks: ["AAPL"] }
                }
              }],
              [{ text: "Approve it on the card." }]
            ]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Draft an Apple picker")
          const [card] = run.cards
          assert(card?._tag === "DraftAgent")

          const { agent } = yield* (yield* TestAgents).sign(user, card.request, "active")

          assert.deepStrictEqual([agent.id, agent.status], [card.agent.id, "active"])
        }))

      it.effect("a draft with problems makes no agent, and the model is told the problems", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Draft an agent with no stocks",
            rounds: [
              [{
                call: "draftAgent",
                params: { name: "Empty", draft: { template: "stockPicker", preset: "balanced", stocks: [] } }
              }],
              [{ text: "It needs at least one stock." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Draft an agent with no stocks")
          const agents = yield* user.api.agents.list()

          assert.deepStrictEqual([run.cards, agents], [[], []])
        }))
    })

    describe("changeAgentPolicies", () => {
      it.effect("prepares a change for the passkey and leaves the agent's policies as they are", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Let my picker trade up to $50 only",
            rounds: [
              [{
                call: "changeAgentPolicies",
                params: {
                  agentId: agent.id,
                  changes: { settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 50 }] }
                }
              }],
              [{ text: "Approve the change on the card." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Let my picker trade up to $50 only")
          const now = yield* user.api.agents.agent({ params: { id: agent.id } })

          assert.deepStrictEqual(
            [
              run.cards.map((card) =>
                card._tag === "PolicyChange" ? [card.action, card.request?.action, card.changes?.overall] : card._tag
              ),
              now.spec
            ],
            [[["update", "update", "tighter"]], agent.spec]
          )
        }))
    })
  }
)
