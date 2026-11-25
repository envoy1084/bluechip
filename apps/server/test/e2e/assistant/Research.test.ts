import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("assistant research", (it) => {
  describe("Anthropic's web search", () => {
    it.effect("shows the pages it read as a research card, each page once, kept in the conversation", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "What did Nvidia report last quarter?",
          rounds: [[
            {
              search: "Nvidia quarterly results",
              results: [
                { url: "https://example.com/nvidia-q3", title: "Nvidia Q3", citedText: "Revenue rose 60%." },
                { url: "https://example.com/chips", title: "Chip makers" },
                { url: "https://example.com/nvidia-q3", title: "Nvidia Q3" }
              ]
            },
            { text: "Revenue rose, as the pages on the card say." }
          ]]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "What did Nvidia report last quarter?")
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })
        const stored = thread.messages.flatMap((message) =>
          message.parts.flatMap((part) => part.type === "card" ? [part.card._tag] : [])
        )

        assert.deepStrictEqual(
          [run.cards.map((card) => card._tag === "Research" ? [card.query, card.citations] : card._tag), stored],
          [[["Nvidia quarterly results", [
            { url: "https://example.com/nvidia-q3", title: "Nvidia Q3", citedText: "Revenue rose 60%." },
            { url: "https://example.com/chips", title: "Chip makers", citedText: null }
          ]]], ["Research"]]
        )
      }))
  })
})
