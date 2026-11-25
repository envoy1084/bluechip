import { NotFound } from "@bluechip/domain/Errors"
import { MemoryId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("assistant memories", (it) => {
  describe("remember", () => {
    it.effect("saves what the user asked, confirmed, and shows it as a card", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Remember that I never want Tesla",
          rounds: [
            [{ call: "remember", params: { kind: "constraint", text: "You never want Tesla.", agentId: null } }],
            [{ text: "Noted." }]
          ]
        })
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "Remember that I never want Tesla")
        const memories = yield* user.api.assistant.memories()

        assert.deepStrictEqual(
          [
            run.cards.map((card) => card._tag === "Memory" ? [card.action, card.status, card.memory.id] : card._tag),
            memories.map((memory) => [memory.text, memory.source, memory.confirmedAt !== null])
          ],
          [[["saved", "applied", memories[0]!.id]], [["You never want Tesla.", "said", true]]]
        )
      }))
  })

  describe("the system prompt", () => {
    it.effect("carries a memory into the next turn", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          {
            to: "Remember I like chip makers",
            rounds: [
              [{ call: "remember", params: { kind: "preference", text: "You like chip makers.", agentId: null } }],
              [{ text: "Noted." }]
            ]
          },
          { to: "What do I like?", rounds: [[{ text: "Chip makers." }]] }
        )
        const conversation = yield* assistant.start(user)
        yield* assistant.ask(user, conversation.id, "Remember I like chip makers")

        yield* assistant.ask(user, conversation.id, "What do I like?")
        const [prompt] = yield* recorded.prompts("What do I like?")

        assert.include(prompt!.content[0]!.content as string, "You like chip makers.")
      }))

    it.effect("never carries a memory the user deleted", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          {
            to: "Remember I live in Lisbon",
            rounds: [
              [{ call: "remember", params: { kind: "fact", text: "You live in Lisbon.", agentId: null } }],
              [{ text: "Noted." }]
            ]
          },
          { to: "Where do I live?", rounds: [[{ text: "I don't know." }]] }
        )
        const conversation = yield* assistant.start(user)
        const first = yield* assistant.ask(user, conversation.id, "Remember I live in Lisbon")
        const [card] = first.cards
        assert(card?._tag === "Memory")
        yield* user.api.assistant.deleteMemory({ params: { id: card.memory.id } })

        yield* assistant.ask(user, conversation.id, "Where do I live?")
        const [prompt] = yield* recorded.prompts("Where do I live?")

        assert.notInclude(prompt!.content[0]!.content as string, "Lisbon")
      }))
  })

  describe("after a turn", () => {
    it.effect("a guess the small model isn't sure of waits for the user, out of prompts", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          {
            to: "I'm saving for a flat, what should I do?",
            rounds: [[{ text: "Let's look at your cash." }]],
            notes: {
              title: null,
              memories: [{
                kind: "goal",
                text: "You're saving for a flat.",
                source: "inferred",
                confidence: 0.6,
                replaces: null
              }]
            }
          },
          { to: "Anything else?", rounds: [[{ text: "No." }]] }
        )
        const conversation = yield* assistant.start(user)

        const run = yield* assistant.ask(user, conversation.id, "I'm saving for a flat, what should I do?")
        yield* assistant.ask(user, conversation.id, "Anything else?")
        const [prompt] = yield* recorded.prompts("Anything else?")
        const last = run.events.at(-1)

        assert.deepStrictEqual(
          [
            run.cards.map((card) => card._tag === "Memory" ? [card.action, card.status] : card._tag),
            last?.type === "RUN_FINISHED" ? last.outcome?.type : undefined,
            (prompt!.content[0]!.content as string).includes("flat")
          ],
          [[["confirm", "pending"]], "interrupt", false]
        )
      }))

    it.effect("a guess the user confirms reaches the next prompt", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          {
            to: "I work at a hospital, can I trade at night?",
            rounds: [[{ text: "Yes, agents trade at any hour." }]],
            notes: {
              title: null,
              memories: [{
                kind: "fact",
                text: "You work at a hospital.",
                source: "inferred",
                confidence: 0.7,
                replaces: null
              }]
            }
          },
          { to: "Thanks", rounds: [[{ text: "Any time." }]] }
        )
        const conversation = yield* assistant.start(user)
        const run = yield* assistant.ask(user, conversation.id, "I work at a hospital, can I trade at night?")

        yield* user.api.assistant.confirmCard({ params: { id: run.cards[0]!.id } })
        yield* assistant.ask(user, conversation.id, "Thanks")
        const [prompt] = yield* recorded.prompts("Thanks")

        assert.include(prompt!.content[0]!.content as string, "You work at a hospital.")
      }))

    it.effect("a guess the user dismisses is forgotten", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "My kids love Nintendo games",
          rounds: [[{ text: "Nintendo isn't listed on bluechip yet." }]],
          notes: {
            title: null,
            memories: [{ kind: "fact", text: "You have kids.", source: "inferred", confidence: 0.6, replaces: null }]
          }
        })
        const conversation = yield* assistant.start(user)
        const run = yield* assistant.ask(user, conversation.id, "My kids love Nintendo games")

        yield* user.api.assistant.dismissCard({ params: { id: run.cards[0]!.id } })
        const memories = yield* user.api.assistant.memories()

        assert.deepStrictEqual(memories, [])
      }))

    it.effect("something said that contradicts a memory replaces it, with a note", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record({
          to: "Remember I avoid Tesla",
          rounds: [
            [{ call: "remember", params: { kind: "preference", text: "You avoid Tesla.", agentId: null } }],
            [{ text: "Noted." }]
          ]
        })
        const conversation = yield* assistant.start(user)
        const first = yield* assistant.ask(user, conversation.id, "Remember I avoid Tesla")
        const [card] = first.cards
        assert(card?._tag === "Memory")
        yield* recorded.record({
          to: "Actually I like Tesla now",
          rounds: [[{ text: "Got it." }]],
          notes: {
            title: null,
            memories: [{
              kind: "preference",
              text: "You like Tesla.",
              source: "said",
              confidence: 0.95,
              replaces: card.memory.id
            }]
          }
        })

        yield* assistant.ask(user, conversation.id, "Actually I like Tesla now")
        const memories = yield* user.api.assistant.memories()

        assert.deepStrictEqual(
          memories.map((memory) => [memory.text, memory.note, memory.confirmedAt !== null]),
          [["You like Tesla.", "Replaces \"You avoid Tesla.\"", true]]
        )
      }))
  })

  describe("DELETE /api/assistant/memories", () => {
    it.effect("forgets everything", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Remember two things",
          rounds: [
            [
              { call: "remember", params: { kind: "fact", text: "You are left-handed.", agentId: null } },
              { call: "remember", params: { kind: "goal", text: "You want to retire early.", agentId: null } }
            ],
            [{ text: "Noted both." }]
          ]
        })
        const conversation = yield* assistant.start(user)
        yield* assistant.ask(user, conversation.id, "Remember two things")

        yield* user.api.assistant.deleteMemories()
        const memories = yield* user.api.assistant.memories()

        assert.deepStrictEqual(memories, [])
      }))
  })

  describe("POST /api/assistant/memories/:id/confirm", () => {
    it.effect("a guess confirmed from the memory page reaches the next prompt, and its card stops asking", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const recorded = yield* RecordedModel
        yield* recorded.record(
          {
            to: "I'm a nurse, when do agents trade?",
            rounds: [[{ text: "At any hour." }]],
            notes: {
              title: null,
              memories: [{
                kind: "fact",
                text: "You are a nurse.",
                source: "inferred",
                confidence: 0.6,
                replaces: null
              }]
            }
          },
          { to: "Good to know", rounds: [[{ text: "Any time." }]] }
        )
        const conversation = yield* assistant.start(user)
        const run = yield* assistant.ask(user, conversation.id, "I'm a nurse, when do agents trade?")
        const [card] = run.cards
        assert(card?._tag === "Memory")

        const memory = yield* user.api.assistant.confirmMemory({ params: { id: card.memory.id } })
        const thread = yield* user.api.assistant.conversation({ params: { id: conversation.id } })
        yield* assistant.ask(user, conversation.id, "Good to know")
        const [prompt] = yield* recorded.prompts("Good to know")

        assert.deepStrictEqual(
          [
            [memory.id, memory.text, memory.confirmedAt !== null],
            thread.messages.flatMap((message) =>
              message.parts.flatMap((part) =>
                part.type === "card" && part.card._tag === "Memory" ? [part.card.status] : []
              )
            ),
            (prompt!.content[0]!.content as string).includes("You are a nurse.")
          ],
          [[card.memory.id, "You are a nurse.", true], ["applied"], true]
        )
      }))

    it.effect("confirming a memory again returns it unchanged", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record({
          to: "Remember I hold for years",
          rounds: [
            [{ call: "remember", params: { kind: "preference", text: "You hold for years.", agentId: null } }],
            [{ text: "Noted." }]
          ]
        })
        const conversation = yield* assistant.start(user)
        yield* assistant.ask(user, conversation.id, "Remember I hold for years")
        const [saved] = yield* user.api.assistant.memories()

        const confirmed = yield* user.api.assistant.confirmMemory({ params: { id: saved!.id } })

        assert.deepStrictEqual(confirmed, saved)
      }))

    it.effect("404: a memory that isn't the user's", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const id = MemoryId.make(typeid("memory").toString())

        const error = yield* user.api.assistant.confirmMemory({ params: { id } }).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "memory", id }) })
      }))
  })

  describe("DELETE /api/assistant/memories/:id", () => {
    it.effect("404: a memory that isn't the user's", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const id = MemoryId.make(typeid("memory").toString())

        const error = yield* user.api.assistant.deleteMemory({ params: { id } }).pipe(Effect.flip)

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "memory", id }) })
      }))
  })
})
