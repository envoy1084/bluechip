import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Memories } from "../../../../src/modules/memory/Memories.ts"
import { Recall } from "../../../../src/modules/memory/Recall.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server's services run on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("Memories", (it) => {
  describe("dropStale", () => {
    it.effect("drops guesses left unconfirmed past the limit, and keeps confirmed memories", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memories = yield* Memories
        yield* memories.learn(owner, {
          kind: "fact",
          text: "You work night shifts.",
          source: "inferred",
          confidence: 0.6,
          replaces: null
        }, null)
        yield* memories.remember(owner, { kind: "fact", text: "You live in Lisbon.", agentId: null, messageId: null })

        const dropped = yield* memories.dropStale(0, { userId: user.id })
        const kept = yield* memories.list(owner)

        assert.deepStrictEqual([dropped, kept.map((memory) => memory.text)], [1, ["You live in Lisbon."]])
      }))

    it.effect("keeps a guess younger than the limit", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memories = yield* Memories
        yield* memories.learn(owner, {
          kind: "fact",
          text: "You work night shifts.",
          source: "inferred",
          confidence: 0.6,
          replaces: null
        }, null)

        const dropped = yield* memories.dropStale(30, { userId: user.id })

        assert.strictEqual(dropped, 0)
      }))
  })

  describe("learn", () => {
    it.effect("a contradiction replaces the memory, with a note, and the old one is no longer recalled", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memories = yield* Memories
        const old = yield* memories.remember(owner, {
          kind: "preference",
          text: "You avoid Tesla.",
          agentId: null,
          messageId: null
        })

        const replaced = yield* memories.learn(owner, {
          kind: "preference",
          text: "You like Tesla now.",
          source: "said",
          confidence: 0.95,
          replaces: old.id
        }, null)
        const recalled = yield* (yield* Recall).search(owner, { text: "Tesla" })

        assert.deepStrictEqual([replaced?.note, recalled.map((hit) => hit.text)], [
          "Replaces \"You avoid Tesla.\"",
          ["You like Tesla now."]
        ])
      }))
  })
})
