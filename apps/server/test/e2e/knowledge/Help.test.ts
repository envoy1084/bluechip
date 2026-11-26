// The assistant answering from bluechip's help and stock facts: what the model reads, with its citations.
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { Knowledge } from "../../../src/modules/knowledge/Knowledge.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("bluechip's knowledge in the assistant", (it) => {
  describe("searchHelp", () => {
    it.effect("the model reads the passages that answer, each with its article, section and link", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* (yield* Knowledge).refresh
        const asked = `What if I lose my passkeys? ${randomUUID()}`
        yield* recorded.record({
          to: asked,
          rounds: [[{ call: "searchHelp", params: { query: "lose every passkey recovery" } }], [{
            text: "Use your recovery key on a new device (Recovery, If you lose every passkey)."
          }]]
        })

        yield* assistant.ask(user, (yield* assistant.start(user)).id, asked)
        const [, second] = yield* recorded.prompts(asked)
        const toolResults = second!.content.flatMap((message) =>
          message.role === "tool" ?
            message.content.flatMap((part) =>
              part.type === "tool-result" ?
                (part.modelOutput ?? []).map((output) => output.type === "text" ? output.text : "") :
                []
            ) :
            []
        )

        assert.include(
          toolResults.join("\n"),
          "[1] Recovery, If you lose every passkey (/help/recovery#if-you-lose-every-passkey):\nRecovery: If you lose " +
            "every passkey\n\nOn a new device, open the recovery page and use your recovery key"
        )
      }))
  })

  describe("getStockFacts", () => {
    it.effect("the model reads a stock's token, feed and pool", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        const asked = `Where does Apple trade? ${randomUUID()}`
        yield* recorded.record({
          to: asked,
          rounds: [[{ call: "getStockFacts", params: { symbol: "AAPL" } }], [{ text: "In its Aerodrome pool." }]]
        })

        yield* assistant.ask(user, (yield* assistant.start(user)).id, asked)
        const [, second] = yield* recorded.prompts(asked)

        assert.include(
          JSON.stringify(second),
          "It trades in its USDC pool on Aerodrome's Slipstream at 0xF5FCB9CDAFcE67d50AfEf298F88E709d2B946BA6"
        )
      }))
  })
})
