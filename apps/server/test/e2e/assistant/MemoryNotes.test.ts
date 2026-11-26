// Memory notes recorded from the conversation model, replayed: what each kind of message leaves on the memory page.
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Memories } from "../../../src/modules/memory/Memories.ts"
import { NOTE_CASES } from "../../fixtures/assistant/MemoryNotes.ts"
import { RecordedModel } from "../../utils/RecordedModel.ts"
import { TestAssistant } from "../../utils/TestAssistant.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAssistant.layer, { excludeTestServices: true })("assistant memory notes", (it) => {
  describe("after a turn", () => {
    it.effect.each(NOTE_CASES)("$name", (note) =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const assistant = yield* TestAssistant
        const me = yield* user.api.account.me()
        const owner = { id: me.user.id, account: user.account }
        const memories = yield* Memories
        const existing = yield* Effect.forEach(note.existing, (memory) =>
          memories.remember(owner, { ...memory, agentId: null, messageId: null }))
        yield* (yield* RecordedModel).record({
          to: note.message,
          rounds: [[{ text: "Noted." }]],
          notes: {
            title: null,
            memories: note.notes.map((candidate) => ({
              ...candidate,
              replaces: candidate.replaces === null ? null : existing[candidate.replaces]!.id
            }))
          }
        })
        const conversation = yield* assistant.start(user)

        yield* assistant.ask(user, conversation.id, note.message)
        const kept = yield* user.api.assistant.memories()

        assert.deepStrictEqual(
          kept.map((memory) => ({
            kind: memory.kind,
            text: memory.text,
            source: memory.source,
            confirmed: memory.confirmedAt !== null,
            note: memory.note
          })),
          note.kept
        )
      }))
  })
})
