import { CARD_EVENT, CardEvent } from "@bluechip/domain/assistant/RunEvents"
import type { CardId, ConversationId, MemoryId, RunId } from "@bluechip/domain/Ids"
import { assert, describe, it } from "@effect/vitest"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { addCard, setBudget, setReplyBehaviour, setReplyPace } from "../../../src/preview/panel/actions/assistant.ts"
import type { PreviewStore } from "../../../src/preview/store.ts"
import { castOf, type ScenarioId } from "../../../src/preview/world/cast.ts"
import { previewApi } from "../../utils/PreviewApi.ts"

const SCENARIOS: ReadonlyArray<ScenarioId> = ["newPerson", "typical", "heavy"]

const decodeCardEvent = Schema.decodeUnknownSync(Schema.toCodecJson(CardEvent))

describe("preview assistant", () => {
  for (const scenario of SCENARIOS) {
    it.effect(`${scenario}: every read of the assistant decodes`, () =>
      Effect.gen(function*() {
        const { client } = yield* previewApi(scenario)
        const cast = castOf(scenario)

        const page = yield* client.assistant.conversations({ query: { pageSize: 100 } })
        for (const conversation of page.items) yield* client.assistant.conversation({ params: { id: conversation.id } })
        const memories = yield* client.assistant.memories({ query: {} })
        yield* client.assistant.memories({ query: { q: "Nvidia cash" } })
        const exported = yield* client.assistant.exportMemories()
        yield* client.assistant.budget()

        assert.deepStrictEqual(
          [page.items.map((conversation) => conversation.id).sort(), exported.memories.length],
          [cast.conversations.map((conversation) => conversation.id).sort(), memories.length]
        )
      }))
  }

  it.effect("newPerson: no conversations or memories, the whole budget left", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("newPerson")

      const page = yield* client.assistant.conversations({ query: {} })
      const memories = yield* client.assistant.memories({ query: {} })
      const budget = yield* client.assistant.budget()

      assert.deepStrictEqual([page.items.length, memories.length, budget.costMicros], [0, 0, 0])
    }))

  it.effect("heavy: the budget nearly used, memories waiting to be confirmed", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("heavy")

      const budget = yield* client.assistant.budget()
      const memories = yield* client.assistant.memories({ query: {} })

      assert.deepStrictEqual([budget.costMicros, budget.limitMicros], [930_000, 1_000_000])
      assert.isAtLeast(memories.filter((memory) => memory.confirmedAt === null).length, 3)
    }))

  it.effect("typical and heavy threads together show every kind of card, in every state", () =>
    Effect.gen(function*() {
      const shown = new Set<string>()
      for (const scenario of ["typical", "heavy"] as const) {
        const { client } = yield* previewApi(scenario)
        const page = yield* client.assistant.conversations({ query: { pageSize: 100 } })
        for (const conversation of page.items) {
          const thread = yield* client.assistant.conversation({ params: { id: conversation.id } })
          for (const message of thread.messages) {
            for (const part of message.parts) {
              if (part.type !== "card") continue
              shown.add(part.card._tag)
              if ("status" in part.card) shown.add(`${part.card._tag}.${part.card.status}`)
              if (part.card._tag === "Error") shown.add(`Error.${part.card.reason}`)
            }
          }
        }
      }

      assert.includeMembers([...shown], [
        "Trade",
        "Approval",
        "DraftAgent",
        "PolicyChange",
        "AgentControl",
        "SaveTemplate",
        "Automation",
        "AutomationControl",
        "Memory",
        "Research",
        "Error",
        "AgentControl.applied",
        "AgentControl.dismissed",
        "SaveTemplate.pending",
        "SaveTemplate.applied",
        "Automation.pending",
        "Automation.applied",
        "Automation.dismissed",
        "AutomationControl.applied",
        "Memory.pending",
        "Memory.applied",
        "Error.budget",
        "Error.rounds",
        "Error.cancelled",
        "Error.interrupted",
        "Error.unavailable"
      ])
    }))

  it.effect("GET /api/assistant/conversations/:id: 404 for a conversation that isn't there", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const error = yield* Effect.flip(
        client.assistant.conversation({ params: { id: "conversation_01kqpv0000700890000000zzzz" as ConversationId } })
      )

      assert.strictEqual(error._tag, "NotFound")
    }))
})

const run = (
  store: PreviewStore,
  client: Effect.Success<ReturnType<typeof previewApi>>["client"],
  threadId: string,
  text: string
) =>
  Effect.gen(function*() {
    setReplyPace.def.apply(store.world, "instant")
    const response = yield* client.assistant.run({
      payload: {
        threadId,
        runId: crypto.randomUUID(),
        messages: [{ id: "you", role: "user", content: text }],
        tools: [],
        context: []
      }
    })
    return Array.from(yield* Stream.runCollect(response.body))
  })

const cardsIn = (events: ReadonlyArray<AgUiSchema.Event>) =>
  events.flatMap((event) =>
    event.type === "CUSTOM" && event.name === CARD_EVENT ? [decodeCardEvent(event).value.card] : []
  )

describe("POST /api/assistant/run", () => {
  it.effect("a buy streams text, the tool call and a trade card, then finishes and is stored", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      const conversation = castOf("typical").conversations[0]!

      const events = yield* run(store, client, conversation.id, "Buy $50 of Nvidia through Tech picker")
      const thread = yield* client.assistant.conversation({ params: { id: conversation.id } })

      assert.deepStrictEqual(
        [events[0]?.type, events.at(-1)?.type, cardsIn(events).map((card) => card._tag)],
        ["RUN_STARTED", "RUN_FINISHED", ["Trade"]]
      )
      assert.includeMembers(events.map((event) => event.type), [
        "TEXT_MESSAGE_CONTENT",
        "TOOL_CALL_START",
        "TOOL_CALL_ARGS",
        "TOOL_CALL_END",
        "TOOL_CALL_RESULT"
      ])
      assert.deepStrictEqual(thread.messages.at(-4)?.parts, [{
        type: "text",
        text: "Buy $50 of Nvidia through Tech picker"
      }])
    }))

  it.effect("a card that waits for you is listed in the run's interrupt", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")

      const events = yield* run(store, client, castOf("typical").conversations[0]!.id, "Pause Tech picker")
      const [card] = cardsIn(events)
      const last = events.at(-1)

      assert.deepStrictEqual(
        last?.type === "RUN_FINISHED" && last.outcome?.type === "interrupt" ?
          last.outcome.interrupts.map((interrupt) => interrupt.id) :
          [],
        [card!.id]
      )
    }))

  it.effect("asking for an agent shows a draft agent card", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("newPerson")

      const conversation = yield* client.assistant.startConversation({ payload: { agentId: null } })
      const events = yield* run(store, client, conversation.id, "Make an agent that buys Apple every week")
      const page = yield* client.assistant.conversations({ query: {} })

      assert.deepStrictEqual(
        [cardsIn(events).map((card) => card._tag), page.items[0]?.title],
        [["DraftAgent"], "Make an agent that buys Apple"]
      )
    }))

  it.effect("with the budget used up, a budget card and no answer", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("heavy")
      setBudget.def.apply(store.world, "spent")

      const events = yield* run(store, client, castOf("heavy").conversations[0]!.id, "How is Apple doing?")

      assert.deepStrictEqual(
        cardsIn(events).map((card) => card._tag === "Error" ? card.reason : card._tag),
        ["budget"]
      )
    }))

  it.effect("when the model fails, the run ends with RUN_ERROR", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      setReplyBehaviour.def.apply(store.world, "fails")

      const events = yield* run(store, client, castOf("typical").conversations[0]!.id, "What is an agent?")

      assert.strictEqual(events.at(-1)?.type, "RUN_ERROR")
    }))

  it.effect("400: a thread that isn't one of yours", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")

      const error = yield* Effect.flip(run(store, client, "conversation_01kqpv0000700890000000zzzz", "Hello"))

      assert.strictEqual(error._tag, "BadRequest")
    }))

  it.effect("POST /api/assistant/runs/:id/cancel stops a run as far as it got", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      setReplyPace.def.apply(store.world, "slow")
      const conversation = castOf("typical").conversations[2]!
      const runId = crypto.randomUUID()
      const typing = yield* Deferred.make<void>()

      const response = yield* client.assistant.run({
        payload: {
          threadId: conversation.id,
          runId,
          messages: [{ id: "you", role: "user", content: "Pause Tech picker" }],
          tools: [],
          context: []
        }
      })
      const collected = yield* response.body.pipe(
        Stream.tap((event) =>
          event.type === "TEXT_MESSAGE_CONTENT" ? Deferred.succeed(typing, undefined) : Effect.void
        ),
        Stream.runCollect,
        Effect.forkChild
      )
      yield* Deferred.await(typing)
      yield* client.assistant.cancel({ params: { id: runId as RunId } })
      const events = Array.from(yield* Fiber.join(collected))
      const last = events.at(-1)

      assert.deepStrictEqual(
        [
          last?.type === "RUN_FINISHED" ? last.outcome?.type : last?.type,
          cardsIn(events).map((card) => card._tag === "Error" ? card.reason : card._tag)
        ],
        ["cancelled", ["cancelled"]]
      )
    }))

  it.effect("POST /api/assistant/runs/:id/cancel: 404 for a run that isn't going", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")

      const error = yield* Effect.flip(client.assistant.cancel({ params: { id: "no-such-run" as RunId } }))

      assert.strictEqual(error._tag, "NotFound")
    }))
})

describe("cards and memories", () => {
  it.effect("confirming a pending card applies it; confirming it again is a conflict", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      addCard.def.apply(store.world, "saveTemplate", "pending", null)
      const thread = store.world.assistant.threads[0]!
      const part = thread.messages[0]!.parts.find((candidate) => candidate.type === "card")!
      const id = (part.type === "card" ? part.card.id : "") as CardId

      const applied = yield* client.assistant.confirmCard({ params: { id } })
      const again = yield* Effect.flip(client.assistant.confirmCard({ params: { id } }))

      assert.deepStrictEqual(
        [applied._tag, applied._tag === "SaveTemplate" ? applied.status : null, again._tag],
        ["SaveTemplate", "applied", "Conflict"]
      )
    }))

  it.effect("dismissing a memory to confirm drops the memory", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      addCard.def.apply(store.world, "memoryConfirm", "pending", null)
      const part = store.world.assistant.threads[0]!.messages[0]!.parts.find((candidate) => candidate.type === "card")!
      const card = part.type === "card" ? part.card : null

      const dismissed = yield* client.assistant.dismissCard({ params: { id: card!.id } })
      const memories = yield* client.assistant.memories({ query: {} })

      assert.deepStrictEqual(
        [
          dismissed._tag === "Memory" ? dismissed.status : null,
          memories.some((memory) => card?._tag === "Memory" && memory.id === card.memory.id)
        ],
        ["dismissed", false]
      )
    }))

  it.effect("a draft agent's automation left out, then the kept ones started", () =>
    Effect.gen(function*() {
      const { client, store } = yield* previewApi("typical")
      addCard.def.apply(store.world, "draftAgent", "applied", null)
      const part = store.world.assistant.threads[0]!.messages[0]!.parts.find((candidate) => candidate.type === "card")!
      const card = part.type === "card" && part.card._tag === "DraftAgent" ? part.card : null
      const [automation] = card!.automations ?? []

      const left = yield* client.assistant.keepCardAutomation({
        params: { id: card!.id, requestId: automation!.requestId },
        payload: { kept: false }
      })
      const started = yield* client.assistant.startCardAutomations({ params: { id: card!.id } })

      assert.deepStrictEqual(
        [
          left._tag === "DraftAgent" ? left.automations?.map((kept) => kept.kept) : null,
          started._tag === "DraftAgent" ? started.automations?.map((kept) => kept.automationId) : null
        ],
        [[false], [null]]
      )
    }))

  it.effect("confirming a memory from the memory page confirms it and answers its card", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("typical")
      const waiting = (yield* client.assistant.memories({ query: {} })).find((memory) => memory.confirmedAt === null)!

      const confirmed = yield* client.assistant.confirmMemory({ params: { id: waiting.id } })
      const thread = yield* client.assistant.conversation({ params: { id: castOf("typical").conversations[1]!.id } })
      const cards = thread.messages.flatMap((message) =>
        message.parts.flatMap((part) =>
          part.type === "card" && part.card._tag === "Memory" && part.card.memory.id === waiting.id ?
            [part.card.status] :
            []
        )
      )

      assert.deepStrictEqual([confirmed.confirmedAt !== null, cards], [true, ["applied"]])
    }))

  it.effect("deleting one memory, then everything", () =>
    Effect.gen(function*() {
      const { client } = yield* previewApi("heavy")
      const [first] = yield* client.assistant.memories({ query: {} })

      yield* client.assistant.deleteMemory({ params: { id: first!.id } })
      const missing = yield* Effect.flip(client.assistant.deleteMemory({ params: { id: first!.id as MemoryId } }))
      yield* client.assistant.deleteMemories()
      const left = yield* client.assistant.memories({ query: {} })
      const exported = yield* client.assistant.exportMemories()

      assert.deepStrictEqual([missing._tag, left.length, exported.summaries.length], ["NotFound", 0, 0])
    }))
})
