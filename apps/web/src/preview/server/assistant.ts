// The mock API's assistant group, answered from the preview world: conversations and their threads, runs over AG-UI
// (`assistant/run.ts`), the cards' answers (`assistant/cards.ts`), memories and the day's budget.
import { BluechipApi } from "@bluechip/domain/Api"
import { Budget } from "@bluechip/domain/assistant/Budget"
import { Conversation, ConversationThread } from "@bluechip/domain/assistant/Conversation"
import { MemoryExport } from "@bluechip/domain/assistant/Memory"
import { NotFound } from "@bluechip/domain/Errors"
import type { ConversationId } from "@bluechip/domain/Ids"
import * as AgUiServer from "effect/ai/AgUiServer"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Layer from "effect/Layer"
import { budgetDay, threadById } from "../world/assistant.ts"
import { makeMint } from "../world/assistant/mint.ts"
import { cardAnswers } from "./assistant/cards.ts"
import { startRun } from "./assistant/run.ts"
import { Preview } from "./Preview.ts"

const DEFAULT_PAGE_SIZE = 20

// Words a search matches, ignoring case and punctuation.
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2)

const AssistantHandlers = HttpApiBuilder.group(
  BluechipApi,
  "assistant",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview
    const slice = () => preview.world.assistant
    const answers = cardAnswers(preview)
    const start = startRun(preview, answers)

    const thread = Effect.fnUntraced(function*(id: string) {
      const found = threadById(slice(), id)
      if (found === undefined) return yield* new NotFound({ resource: "conversation", id })
      return found
    })

    return handlers.handleAll({
      conversations: ({ query }) =>
        Effect.sync(() => {
          const size = query.pageSize ?? DEFAULT_PAGE_SIZE
          const from = query.pageToken === undefined ? 0 : Number(query.pageToken)
          const threads = slice().threads.slice(from, from + size)
          const next = from + size < slice().threads.length ? String(from + size) : null
          return { items: threads.map((shown) => shown.conversation), nextPageToken: next }
        }),

      startConversation: ({ payload }) =>
        Effect.gen(function*() {
          if (payload.agentId !== null && !preview.cast.agents.some((agent) => agent.id === payload.agentId)) {
            return yield* new NotFound({ resource: "agent", id: payload.agentId })
          }
          const mint = makeMint(preview.cast, new Date(), slice().counters, "run")
          const conversation = new Conversation({
            id: mint.id("conversation") as ConversationId,
            agentId: payload.agentId,
            surface: "web",
            title: null,
            createdAt: mint.at(0),
            updatedAt: mint.at(0)
          })
          preview.update(() => {
            slice().threads.unshift({ conversation, messages: [] })
          })
          return conversation
        }),

      conversation: ({ params }) =>
        Effect.map(
          thread(params.id),
          (found) => new ConversationThread({ conversation: found.conversation, messages: found.messages })
        ),

      run: ({ payload }) => Effect.flatMap(start(payload), (events) => AgUiServer.handler(() => events)({ payload })),

      cancel: ({ params }) =>
        Effect.gen(function*() {
          const run = slice().runs.get(params.id)
          if (run === undefined) return yield* new NotFound({ resource: "run", id: params.id })
          run.cancelled = true
        }),

      confirmCard: ({ params }) => answers.confirm(params.id),
      dismissCard: ({ params }) => answers.dismiss(params.id),
      keepCardAutomation: ({ params, payload }) => answers.keepAutomation(params.id, params.requestId, payload.kept),
      startCardAutomations: ({ params }) => answers.startAutomations(params.id),

      memories: ({ query }) =>
        Effect.sync(() => {
          const memories = slice().memories
          if (query.q === undefined || query.q.trim() === "") return memories
          const asked = words(query.q)
          // Best first: the memories sharing the most words with the search.
          return memories
            .map((memory) => ({ memory, score: words(memory.text).filter((word) => asked.includes(word)).length }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .map(({ memory }) => memory)
        }),

      exportMemories: () =>
        Effect.map(
          DateTime.now,
          (exportedAt) => new MemoryExport({ exportedAt, memories: slice().memories, summaries: slice().summaries })
        ),

      confirmMemory: ({ params }) => answers.confirmMemory(params.id),

      deleteMemory: ({ params }) =>
        Effect.gen(function*() {
          if (!slice().memories.some((memory) => memory.id === params.id)) {
            return yield* new NotFound({ resource: "memory", id: params.id })
          }
          preview.update(() => {
            slice().memories = slice().memories.filter((memory) => memory.id !== params.id)
          })
        }),

      deleteMemories: () =>
        Effect.sync(() =>
          preview.update(() => {
            slice().memories = []
            slice().summaries = []
          })
        ),

      budget: () => Effect.sync(() => new Budget({ day: budgetDay(), ...slice().budget }))
    })
  })
)

export const AssistantGroupsLive = Layer.mergeAll(AssistantHandlers)
