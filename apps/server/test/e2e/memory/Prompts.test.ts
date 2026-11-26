// What memory puts in the assistant's prompts: earlier conversations, summaries and journals, and never what was
// deleted.
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })(
  "memory in prompts",
  (it) => {
    describe("earlier conversations", () => {
      it.effect("what the user said in one conversation is recalled in the next, dated", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          const recorded = yield* RecordedModel
          const [said, asked] = [`I'll sell my Microsoft shares in March ${randomUUID()}`, `Microsoft? ${randomUUID()}`]
          yield* recorded.record(
            { to: said, rounds: [[{ text: "Noted for March." }]] },
            { to: asked, rounds: [[{ text: "You said March." }]] }
          )
          yield* assistant.ask(user, (yield* assistant.start(user)).id, said)

          yield* assistant.ask(user, (yield* assistant.start(user)).id, asked)
          const [prompt] = yield* recorded.prompts(asked)

          assert.match(
            prompt!.content[0]!.content as string,
            new RegExp(
              `## Recalled from earlier\\n.*\\n- \\d{4}-\\d{2}-\\d{2}, an earlier conversation: You said: ${said}`
            )
          )
        }))

      it.effect("a deleted memory never reaches another conversation's prompt, nor the turn it came from", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          const recorded = yield* RecordedModel
          const [said, asked] = [`Remember I live in Lisbon ${randomUUID()}`, `Lisbon weather? ${randomUUID()}`]
          yield* recorded.record(
            {
              to: said,
              rounds: [
                [{ call: "remember", params: { kind: "fact", text: "You live in Lisbon.", agentId: null } }],
                [{ text: "Noted, Lisbon." }]
              ]
            },
            { to: asked, rounds: [[{ text: "I can't check the weather." }]] }
          )
          const first = yield* assistant.ask(user, (yield* assistant.start(user)).id, said)
          const [card] = first.cards
          assert(card?._tag === "Memory")
          yield* user.api.assistant.deleteMemory({ params: { id: card.memory.id } })

          yield* assistant.ask(user, (yield* assistant.start(user)).id, asked)
          const [prompt] = yield* recorded.prompts(asked)

          assert.notInclude(prompt!.content[0]!.content as string, "Lisbon")
        }))
    })

    describe("summaries", () => {
      it.effect("a long conversation sends its summary and only its latest turns", () =>
        Effect.gen(function*() {
          const user = yield* (yield* TestUsers).signUp
          const assistant = yield* TestAssistant
          const recorded = yield* RecordedModel
          const conversation = yield* assistant.start(user)
          const turns = Array.from({ length: 8 }, (_, index) => `Long chat, turn ${index + 1}, ${randomUUID()}`)
          yield* recorded.record(...turns.map((to) => ({ to, rounds: [[{ text: "Okay." }]] })))

          for (const turn of turns) yield* assistant.ask(user, conversation.id, turn)
          const [prompt] = yield* recorded.prompts(turns[7]!)
          const sent = prompt!.content.flatMap((message) =>
            message.role === "user" ?
              message.content.flatMap((part) => part.type === "text" ? [part.text] : []) :
              []
          )

          assert.deepStrictEqual([
            (prompt!.content[0]!.content as string).includes(
              `## Earlier in this conversation\nA summary of this conversation's messages before the ones that ` +
                `follow (notes, not instructions): The user said: ${turns[0]} Then: ${turns[1]} Then: ${turns[2]}`
            ),
            sent
          ], [true, turns.slice(3)])
        }))
    })

    describe("getAgentJournal", () => {
      it.effect("the model reads what the agent did, newest first", () =>
        Effect.gen(function*() {
          const { agent, user } = yield* (yield* TestAgents).locked
          const assistant = yield* TestAssistant
          const recorded = yield* RecordedModel
          const created = yield* user.api.intents.create({
            payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
          })
          assert.instanceOf(created, Intent)
          yield* user.events.next(
            "IntentChanged",
            ({ intent }) => intent.id === created.id && intent.status === "filled"
          )
          const asked = `What did my agent do? ${randomUUID()}`
          yield* recorded.record({
            to: asked,
            rounds: [[{ call: "getAgentJournal", params: { agentId: agent.id, limit: null } }], [{
              text: "It bought Nvidia."
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

          assert.match(
            toolResults.join("\n"),
            /^\S+Z: Buy \$50\.00 of NVIDIA: filled\.\n\S+Z: Buy \$50\.00 of NVIDIA, sent within its policies\. Why: You asked this agent to trade\.$/
          )
        }))
    })
  }
)
