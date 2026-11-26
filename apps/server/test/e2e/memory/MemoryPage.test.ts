// The memory page's routes: search, usage, export and deletion, as the web app calls them.
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Recall } from "../../../src/modules/memory/Recall.ts"
import { ANA, BEN } from "../../fixtures/memory/History.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("the memory page", (it) => {
  describe("GET /api/assistant/memories?q=", () => {
    it.effect("the memories it recalls, best first, and never another user's", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const assistant = yield* TestAssistant
        const [ana, ben] = [yield* users.signUp, yield* users.signUp]
        const text = (who: string) => `Remember my rules ${who} ${crypto.randomUUID()}`
        const [anaText, benText] = [text("Ana"), text("Ben")]
        yield* (yield* RecordedModel).record(
          {
            to: anaText,
            rounds: [ANA.map((memory) => ({ call: "remember", params: { ...memory, agentId: null } })), [{
              text: "Noted."
            }]]
          },
          {
            to: benText,
            rounds: [BEN.map((memory) => ({ call: "remember", params: { ...memory, agentId: null } })), [{
              text: "Noted."
            }]]
          }
        )
        yield* assistant.ask(ana, (yield* assistant.start(ana)).id, anaText)
        yield* assistant.ask(ben, (yield* assistant.start(ben)).id, benText)

        const found = yield* ana.api.assistant.memories({ query: { q: "Where do I live?" } })

        assert.deepStrictEqual(found.map((memory) => memory.text), ["You live in Lisbon."])
      }))

    it.effect("a search that recalls nothing is empty", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const found = yield* user.api.assistant.memories({ query: { q: "Tesla" } })

        assert.deepStrictEqual(found, [])
      }))
  })

  describe("uses", () => {
    it.effect("a memory recalled for an answer counts it, and one that wasn't doesn't", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const remember = `Remember two things ${crypto.randomUUID()}`
        yield* (yield* RecordedModel).record(
          {
            to: remember,
            rounds: [[
              { call: "remember", params: { kind: "constraint", text: "You never want Tesla.", agentId: null } },
              { call: "remember", params: { kind: "fact", text: "You live in Lisbon.", agentId: null } }
            ], [{ text: "Noted." }]]
          },
          { to: "Should I buy Tesla?", rounds: [[{ text: "You said never." }]] }
        )
        const conversation = yield* assistant.start(user)
        yield* assistant.ask(user, conversation.id, remember)

        yield* assistant.ask(user, conversation.id, "Should I buy Tesla?")
        const memories = yield* user.api.assistant.memories({ query: {} })

        assert.deepStrictEqual(memories.map((memory) => [memory.text, memory.uses, memory.lastUsedAt !== null]), [
          ["You live in Lisbon.", 0, false],
          ["You never want Tesla.", 1, true]
        ])
      }))
  })

  describe("GET /api/assistant/memories/export", () => {
    it.effect("every memory with its uses, and the conversations' summaries", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const text = `Remember I hold for years ${crypto.randomUUID()}`
        yield* (yield* RecordedModel).record({
          to: text,
          rounds: [
            [{ call: "remember", params: { kind: "preference", text: "You hold for years.", agentId: null } }],
            [{ text: "Noted." }]
          ]
        })
        yield* assistant.ask(user, (yield* assistant.start(user)).id, text)

        const exported = yield* user.api.assistant.exportMemories()

        assert.deepStrictEqual(
          [exported.memories.map((memory) => [memory.text, memory.source, memory.uses]), exported.summaries],
          [[["You hold for years.", "said", 0]], []]
        )
      }))
  })

  describe("DELETE /api/assistant/memories", () => {
    it.effect("forgets memories, summaries and what earlier conversations could recall, in one go", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        const conversation = yield* assistant.start(user)
        const turns = Array.from(
          { length: 7 },
          (_, index) => `Forget-me turn ${index + 1} about Rivian ${crypto.randomUUID()}`
        )
        yield* recorded.record(
          {
            to: turns[0]!,
            rounds: [
              [{ call: "remember", params: { kind: "fact", text: "You drive a Rivian.", agentId: null } }],
              [{ text: "Noted." }]
            ]
          },
          ...turns.slice(1).map((to) => ({ to, rounds: [[{ text: "Okay." }]] }))
        )
        for (const turn of turns) yield* assistant.ask(user, conversation.id, turn)
        const before = yield* user.api.assistant.exportMemories()

        yield* user.api.assistant.deleteMemories()
        const after = yield* user.api.assistant.exportMemories()
        const recalled = yield* (yield* Recall).search({ id: user.id, account: user.account }, {
          text: "Rivian",
          includeUnconfirmed: true
        })

        assert.deepStrictEqual(
          [before.memories.length, before.summaries.length, after.memories, after.summaries, recalled],
          [1, 1, [], [], []]
        )
      }))
  })

  describe("DELETE /api/assistant/memories/:id", () => {
    it.effect("deletes it from what can be recalled, with the turn it came from", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const text = `Remember I live in Porto ${crypto.randomUUID()}`
        yield* (yield* RecordedModel).record({
          to: text,
          rounds: [
            [{ call: "remember", params: { kind: "fact", text: "You live in Porto.", agentId: null } }],
            [{ text: "Noted, Porto." }]
          ]
        })
        const run = yield* assistant.ask(user, (yield* assistant.start(user)).id, text)
        const [card] = run.cards
        assert(card?._tag === "Memory")

        yield* user.api.assistant.deleteMemory({ params: { id: card.memory.id } })
        const recalled = yield* (yield* Recall).search({ id: user.id, account: user.account }, {
          text: "Porto",
          includeUnconfirmed: true
        })

        assert.deepStrictEqual(recalled, [])
      }))

    it.effect("deletes the conversation turn it came from, and keeps the turns after it", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const conversation = yield* assistant.start(user)
        const [said, asked] = [`Remember I sail ${crypto.randomUUID()}`, `What's new? ${crypto.randomUUID()}`]
        yield* (yield* RecordedModel).record(
          {
            to: said,
            rounds: [
              [{ call: "remember", params: { kind: "fact", text: "You sail.", agentId: null } }],
              [{ text: "Noted, sailing." }]
            ]
          },
          { to: asked, rounds: [[{ text: "Nothing yet." }]] }
        )
        const run = yield* assistant.ask(user, conversation.id, said)
        yield* assistant.ask(user, conversation.id, asked)
        const [card] = run.cards
        assert(card?._tag === "Memory")

        yield* user.api.assistant.deleteMemory({ params: { id: card.memory.id } })
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })

        assert.deepStrictEqual(
          thread.messages.map((message) => [
            message.role,
            message.parts.flatMap((part) => part.type === "text" ? [part.text] : []).join("")
          ]),
          [["user", asked], ["assistant", "Nothing yet."]]
        )
      }))

    it.effect.each([
      { name: "in the turns its summary covers: the summary goes too", from: 0, summaries: 0 },
      { name: "in a turn after its summary: the summary stays", from: 6, summaries: 1 }
    ])("a memory from a long conversation, $name", ({ from, summaries }) =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const conversation = yield* assistant.start(user)
        const turns = Array.from({ length: 7 }, (_, index) => `Summarised turn ${index + 1} ${crypto.randomUUID()}`)
        yield* (yield* RecordedModel).record(
          ...turns.map((to, index) => ({
            to,
            rounds: index === from ?
              [
                [{ call: "remember", params: { kind: "fact", text: "You keep bees.", agentId: null } }],
                [{ text: "Noted." }]
              ] :
              [[{ text: "Okay." }]]
          }))
        )
        for (const turn of turns) yield* assistant.ask(user, conversation.id, turn)
        const before = yield* user.api.assistant.exportMemories()

        yield* user.api.assistant.deleteMemory({ params: { id: before.memories[0]!.id } })
        const after = yield* user.api.assistant.exportMemories()

        assert.deepStrictEqual([before.summaries.length, after.summaries.length], [1, summaries])
      }))
  })
})
