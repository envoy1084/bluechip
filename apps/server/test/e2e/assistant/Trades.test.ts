import { Devnet } from "@bluechip/devnet/Devnet"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "assistant trades",
  (it) => {
    describe("proposeTrade", () => {
      it.effect("a $50 buy through an agent, within its policies: a trade card the agent sends", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Buy $50 of Nvidia with my picker",
            rounds: [
              [{
                call: "proposeTrade",
                params: {
                  agentId: agent.id,
                  symbol: "NVDA",
                  side: "buy",
                  dollars: 50,
                  shares: null,
                  reason: "You asked for $50 of Nvidia."
                }
              }],
              [{ text: "Your picker is on it, as the card shows." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Buy $50 of Nvidia with my picker")
          const [card] = run.cards
          assert(card?._tag === "Trade")
          const { intent: filled } = yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === card.intent.id && intent.status === "filled"
          )

          assert.deepStrictEqual(
            [card.intent.source, card.intent.executor, card.intent.decision?._tag, filled.agentId],
            ["assistant", "agent", "Passes", agent.id]
          )
        }))

      it.effect("a $150 buy, over the agent's $100 largest trade: a card waiting for your approval", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Buy $150 of Nvidia with my picker",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: agent.id, symbol: "NVDA", side: "buy", dollars: 150, shares: null, reason: "Asked." }
              }],
              [{ text: "It needs your Face ID." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Buy $150 of Nvidia with my picker")

          assert.deepStrictEqual(
            run.cards.map((card) => card._tag === "Trade" ? [card.intent.status, card.intent.decision] : card._tag),
            [["needsApproval", { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(100_000_000n) }]]
          )
        }))

      it.effect("a buy past the agent's cap in one stock: a card blocked by that policy", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          // $1,000 of cash and about $500 of NVIDIA: another $100 takes NVIDIA past 30%.
          yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(300_000_000))
          yield* (yield* RecordedModel).record({
            to: "Buy $100 more Nvidia with my picker",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: agent.id, symbol: "NVDA", side: "buy", dollars: 100, shares: null, reason: "Asked." }
              }],
              [{ text: "Your policies blocked it." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Buy $100 more Nvidia with my picker")

          assert.deepStrictEqual(
            run.cards.map((card) =>
              card._tag === "Trade" && card.intent.decision?._tag === "Refused" ?
                [card.intent.status, card.intent.decision.policy] :
                card._tag
            ),
            [["blocked", "stockCap"]]
          )
        }))

      it.effect("a buy as you: a card prepared for your Face ID, and nothing is sent", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Buy $20 of Apple for me",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: null, symbol: "AAPL", side: "buy", dollars: 20, shares: null, reason: "Asked." }
              }],
              [{ text: "Approve it on the card." }]
            ]
          })
          const conversation = yield* assistant.start(user)

          const run = yield* assistant.ask(user, conversation.id, "Buy $20 of Apple for me")
          const activity = yield* user.api.activity.list({ query: { kind: "trades" } })

          assert.deepStrictEqual(
            [
              run.cards.map((card) =>
                card._tag === "Approval"
                  ? [card.intent.status, card.intent.executor, card.request.quote.usdc]
                  : card._tag
              ),
              activity.items.length
            ],
            [[["awaitingSignature", "owner", Usdc.make(20_000_000n)]], 0]
          )
        }))

      it.effect("reopened after the agent's trade filled: its card shows the trade filled", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Buy $40 of Nvidia with my picker, then show me",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: agent.id, symbol: "NVDA", side: "buy", dollars: 40, shares: null, reason: "Asked." }
              }],
              [{ text: "On its way." }]
            ]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Buy $40 of Nvidia with my picker, then show me")
          const [card] = run.cards
          assert(card?._tag === "Trade")
          yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === card.intent.id && intent.status === "filled"
          )

          const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

          assert.deepStrictEqual(
            thread.messages.flatMap((message) =>
              message.parts.flatMap((part) =>
                part.type === "card" && part.card._tag === "Trade" ? [part.card.intent.status] : []
              )
            ),
            ["filled"]
          )
        }))

      it.effect("reopened after you declined its trade: the approval card shows it declined", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Buy $20 of Apple for me, or not",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: null, symbol: "AAPL", side: "buy", dollars: 20, shares: null, reason: "Asked." }
              }],
              [{ text: "Approve it on the card." }]
            ]
          })
          const conversation = yield* assistant.start(user)
          const run = yield* assistant.ask(user, conversation.id, "Buy $20 of Apple for me, or not")
          const [card] = run.cards
          assert(card?._tag === "Approval")
          yield* user.api.intents.decline({ params: { id: card.intent.id } })

          const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

          assert.deepStrictEqual(
            thread.messages.flatMap((message) =>
              message.parts.flatMap((part) =>
                part.type === "card" && part.card._tag === "Approval" ?
                  [[part.card.intent.status, part.card.request.intent.status]] :
                  []
              )
            ),
            [["declined", "declined"]]
          )
        }))

      it.effect("an agent that isn't the user's: no card, and the model is told why", () =>
        Effect.gen(function*() {
          const { agent } = yield* (yield* TestAgents).locked
          const stranger = yield* (yield* TestUsers).funded
          const assistant = yield* TestAssistant
          yield* (yield* RecordedModel).record({
            to: "Trade with that other agent",
            rounds: [
              [{
                call: "proposeTrade",
                params: { agentId: agent.id, symbol: "NVDA", side: "buy", dollars: 10, shares: null, reason: "Asked." }
              }],
              [{ text: "I can't use that agent." }]
            ]
          })
          const conversation = yield* assistant.start(stranger)

          const run = yield* assistant.ask(stranger, conversation.id, "Trade with that other agent")
          const result = run.events.find((event) => event.type === "TOOL_CALL_RESULT")

          assert.deepStrictEqual(
            [
              run.cards,
              result?.type === "TOOL_CALL_RESULT" && typeof result.content === "string" ?
                JSON.parse(result.content) :
                undefined
            ],
            [[], { _tag: "ToolProblem", problem: `There is no agent ${agent.id} for this user.` }]
          )
        }))
    })
  }
)
