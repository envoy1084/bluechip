import { assert, describe, layer } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Memories } from "../../../../src/modules/memory/Memories.ts"
import { Recall } from "../../../../src/modules/memory/Recall.ts"
import { RecallIndex } from "../../../../src/modules/memory/RecallIndex.ts"
import { Database } from "../../../../src/platform/db/Database.ts"
import { ANA, BEN, RECALL_CASES } from "../../../fixtures/memory/History.ts"
import { FailingEmbeddings } from "../../../utils/FailingEmbeddings.ts"
import { RecordedModel } from "../../../utils/RecordedModel.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"
import { TestAssistant } from "../../../utils/TestAssistant.ts"
import { testDatabaseUrl } from "../../../utils/TestConfig.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The recall index while the embedder is down, on the test database (built afresh: the server's is memoized).
const IndexWhileDown = Layer.fresh(RecallIndex.layer).pipe(
  Layer.provide(Layer.merge(Database.layer, FailingEmbeddings)),
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ DATABASE_URL: testDatabaseUrl })))
)

// The server's services run on the real clock (see `TestServer`).
layer(Layer.mergeAll(TestAssistant.layerNoDeps, TestAgents.layer), { excludeTestServices: true })("Recall", (it) => {
  describe("search", () => {
    it.effect.each(RECALL_CASES)("$name", (example) =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const memories = yield* Memories
        const [ana, ben] = [yield* users.signUp, yield* users.signUp]
        const owner = { id: ana.id, account: ana.account }
        yield* Effect.forEach(ANA, (memory) => memories.remember(owner, { ...memory, agentId: null, messageId: null }))
        yield* Effect.forEach(BEN, (memory) =>
          memories.remember({ id: ben.id, account: ben.account }, { ...memory, agentId: null, messageId: null }))

        const hits = yield* (yield* Recall).search(owner, { text: example.query })

        assert.deepStrictEqual(
          [
            hits[0]?.text ?? null,
            hits.filter((hit) =>
              BEN.some((memory) =>
                memory.text === hit.text
              )
            )
          ],
          [example.first, []]
        )
      }))

    it.effect("an unconfirmed guess is found only when asked for", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memories = yield* Memories
        const recall = yield* Recall
        yield* memories.learn(owner, {
          kind: "fact",
          text: "You work night shifts.",
          source: "inferred",
          confidence: 0.6,
          replaces: null
        }, null)

        const [hidden, shown] = [
          yield* recall.search(owner, { text: "night shifts" }),
          yield* recall.search(owner, { text: "night shifts", includeUnconfirmed: true })
        ]

        assert.deepStrictEqual([hidden, shown.map((hit) => hit.text)], [[], ["You work night shifts."]])
      }))

    it.effect("an earlier conversation's message is recalled, the conversation left out isn't", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const assistant = yield* TestAssistant
        yield* (yield* RecordedModel).record(
          { to: "I might sell my Microsoft shares in March", rounds: [[{ text: "Noted for March." }]] },
          { to: "What about my Microsoft shares?", rounds: [[{ text: "Let's look." }]] }
        )
        const [earlier, now] = [yield* assistant.start(user), yield* assistant.start(user)]
        yield* assistant.ask(user, earlier.id, "I might sell my Microsoft shares in March")
        yield* assistant.ask(user, now.id, "What about my Microsoft shares?")

        const hits = yield* (yield* Recall).search(owner, {
          text: "Microsoft shares",
          kinds: ["message"],
          excludeConversation: now.id
        })

        assert.deepStrictEqual(hits.map((hit) => hit.text), ["You said: I might sell my Microsoft shares in March"])
      }))

    it.effect("in a conversation about an agent, another agent's memories are left out", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const owner = { id: user.id, account: user.account }
        const agents = yield* TestAgents
        const memories = yield* Memories
        const [picker, other] = [(yield* agents.create(user)).agent, (yield* agents.create(user)).agent]
        yield* memories.remember(owner, {
          kind: "preference",
          text: "This agent should buy on dips.",
          agentId: picker.id,
          messageId: null
        })
        yield* memories.remember(owner, {
          kind: "preference",
          text: "That agent should never buy on dips.",
          agentId: other.id,
          messageId: null
        })

        const hits = yield* (yield* Recall).search(owner, { text: "buy on dips", agentId: picker.id })

        assert.deepStrictEqual(hits.map((hit) => hit.text), ["This agent should buy on dips."])
      }))

    it.effect("a newer memory ranks above an equally good older one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memories = yield* Memories
        const older = yield* memories.remember(owner, {
          kind: "fact",
          text: "You hold Nvidia.",
          agentId: null,
          messageId: null
        })
        yield* RecallIndex.use((index) =>
          index.index([{
            kind: "memory",
            sourceId: older.id,
            userId: user.id,
            agentId: null,
            conversationId: null,
            text: older.text,
            importance: 0.7,
            at: DateTime.subtract(older.createdAt, { days: 120 })
          }])
        )
        yield* memories.remember(owner, { kind: "fact", text: "You hold Nvidia.", agentId: null, messageId: null })

        const hits = yield* (yield* Recall).search(owner, { text: "Nvidia" })

        assert.deepStrictEqual(hits.map((hit) => hit.sourceId === older.id), [false, true])
      }))
  })

  describe("RecallIndex", () => {
    it.effect("an entry written while the embedder is down is found by its words, and the embed job embeds it", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const owner = { id: user.id, account: user.account }
        const memory = yield* (yield* Memories).remember(owner, {
          kind: "goal",
          text: "You want to retire early.",
          agentId: null,
          messageId: null
        })
        const source = {
          kind: "memory",
          sourceId: memory.id,
          userId: user.id,
          agentId: null,
          conversationId: null,
          text: "You want to retire at fifty.",
          importance: 0.8,
          at: memory.createdAt
        } as const
        yield* RecallIndex.use((index) => index.index([source])).pipe(Effect.provide(IndexWhileDown))

        const found = yield* (yield* Recall).search(owner, { text: "retire" })
        const [embedded, again] = [
          yield* RecallIndex.use((index) => index.embedPending({ userId: user.id })),
          yield* RecallIndex.use((index) => index.embedPending({ userId: user.id }))
        ]

        assert.deepStrictEqual([found.map((hit) => hit.text), embedded, again], [
          ["You want to retire at fifty."],
          1,
          0
        ])
      }))
  })
})
