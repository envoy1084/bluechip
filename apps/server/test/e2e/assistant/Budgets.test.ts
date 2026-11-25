import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { Budgets } from "../../../src/modules/assistant/Budgets.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("assistant budgets", (it) => {
  describe("GET /api/assistant/budget", () => {
    it.effect("a turn adds the tokens and cost of its rounds, notes and title to today's spend", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Say hello",
          usage: { input: 1000, output: 100 },
          rounds: [[{ text: "Hello." }]]
        })
        const conversation = yield* assistant.start(user)

        yield* assistant.ask(user, conversation.id, "Say hello")
        const budget = yield* user.api.assistant.budget()

        // The recorded models aren't priced, so both are charged as Sonnet: the round's 1,000 tokens in and 100 out
        // ($0.003), then the notes' and the new conversation's title's 200 in and 20 out each ($0.0006 each).
        assert.deepStrictEqual({ ...budget }, {
          day: DateTime.formatIsoDateUtc(yield* DateTime.now),
          inputTokens: 1400,
          outputTokens: 140,
          costMicros: 4200,
          limitMicros: 1_000_000
        })
      }))
  })

  describe("a spent day", () => {
    it.effect("stops the model: the run says so with a card, and the model is never called", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        const me = yield* user.api.account.me()
        yield* (yield* Budgets).record({ id: me.user.id, account: user.account }, "claude-sonnet-5-5", {
          inputTokens: 0,
          outputTokens: 100_000,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        })
        yield* recorded.record({ to: "Are you still there?", rounds: [[{ text: "Yes." }]] })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "Are you still there?")
        const prompts = yield* recorded.prompts("Are you still there?")

        assert.deepStrictEqual(
          [run.cards.map((card) => card._tag === "Error" ? card.reason : card._tag), prompts.length],
          [["budget"], 0]
        )
      }))

    it.effect("still applies a card the user confirms", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const me = yield* user.api.account.me()
        yield* (yield* RecordedModel).record({
          to: "I'm a teacher, by the way",
          rounds: [[{ text: "Nice to know." }]],
          notes: {
            title: null,
            memories: [{ kind: "fact", text: "You're a teacher.", source: "inferred", confidence: 0.6, replaces: null }]
          }
        })
        const conversation = yield* assistant.start(user)
        const run = yield* assistant.ask(user, conversation.id, "I'm a teacher, by the way")
        yield* (yield* Budgets).record({ id: me.user.id, account: user.account }, "claude-sonnet-5-5", {
          inputTokens: 0,
          outputTokens: 100_000,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        })

        const applied = yield* user.api.assistant.confirmCard({ params: { id: run.cards[0]!.id } })

        assert.deepStrictEqual("status" in applied ? applied.status : undefined, "applied")
      }))
  })
})
