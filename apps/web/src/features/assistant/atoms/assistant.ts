import { MemoryExport } from "@bluechip/domain/assistant/Memory"
import type { ConversationId, SigningRequestId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type * as AgUiSchema from "effect/ai/AgUiSchema"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { BluechipApiClient, liveReactivityKey } from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

/** Conversations, memories and the day's budget refetch when this key is invalidated (after a run or a card). */
export const assistantReactivityKey = "assistant"

const reactivityKeys = [assistantReactivityKey, liveReactivityKey]

/** How many conversations the list shows. */
const conversationPageSize = 30

/** Your latest conversations, newest first. */
export const conversationsAtom = BluechipApiClient.query("assistant", "conversations", {
  query: { pageSize: conversationPageSize },
  reactivityKeys
})

/** What the assistant remembers about you: every memory, newest first, or the ones a search recalls, best first. */
export const memoriesAtom = Atom.family((search: string) =>
  BluechipApiClient.query("assistant", "memories", {
    query: search.trim() === "" ? {} : { q: search.trim() },
    reactivityKeys
  })
)

/** Today's model cost against the daily budget. */
export const budgetAtom = BluechipApiClient.query("assistant", "budget", { reactivityKeys })

export const startConversationAtom = BluechipApiClient.mutation("assistant", "startConversation")

export const deleteConversationAtom = BluechipApiClient.mutation("assistant", "deleteConversation")

export const confirmCardAtom = BluechipApiClient.mutation("assistant", "confirmCard")

export const dismissCardAtom = BluechipApiClient.mutation("assistant", "dismissCard")

/** Keeps or leaves out one of a draft agent card's automations. */
export const keepCardAutomationAtom = BluechipApiClient.mutation("assistant", "keepCardAutomation")

/** Starts a draft agent card's kept automations once its agent is live. */
export const startCardAutomationsAtom = BluechipApiClient.mutation("assistant", "startCardAutomations")

export const cancelRunAtom = BluechipApiClient.mutation("assistant", "cancel")

export const confirmMemoryAtom = BluechipApiClient.mutation("assistant", "confirmMemory")

export const deleteMemoryAtom = BluechipApiClient.mutation("assistant", "deleteMemory")

export const deleteMemoriesAtom = BluechipApiClient.mutation("assistant", "deleteMemories")

/** Everything the assistant remembers, as the JSON file the memory page downloads, with the day it was made. */
export const exportMemoriesAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const exported = yield* client.assistant.exportMemories()
    const encoded = yield* Schema.encodeEffect(Schema.toCodecJson(MemoryExport))(exported).pipe(Effect.orDie)
    const json = JSON.stringify(encoded, null, 2)
    return { exportedAt: exported.exportedAt, json }
  })
)

/** A conversation with every message, read once when it opens (a run then adds to it as it streams). */
export const loadThreadAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(id: ConversationId) {
    const client = yield* BluechipApiClient
    return yield* client.assistant.conversation({ params: { id } })
  })
)

/**
 * One run of the assistant over AG-UI: posts the input, then hands each event of its stream to `onEvent` until the run
 * ends. Fails before the stream opens when the server refuses the input (`400`).
 */
export const runAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(run: {
    readonly input: AgUiSchema.RunAgentInput
    readonly onEvent: (event: AgUiSchema.Event) => void
  }) {
    const client = yield* BluechipApiClient
    const response = yield* client.assistant.run({ payload: run.input })
    yield* Stream.runForEach(response.body, (event) => Effect.sync(() => run.onEvent(event)))
  }),
  { reactivityKeys: [assistantReactivityKey] }
)

/** A stock's past day, for the sparkline on a stock's result card. */
export const stockDayAtom = Atom.family((symbol: StockSymbol) =>
  BluechipApiClient.query("market", "history", {
    params: { symbol },
    query: { range: "1D" },
    reactivityKeys: [liveReactivityKey],
    timeToLive: "5 minutes"
  })
)

/** Prepares the card's trade again, with a fresh quote, after its request ran out: the same intent, not a new one. */
export const prepareIntentAtom = BluechipApiClient.mutation("intents", "approve")

/** Signs a prepared trade with the account's passkey (Face ID) and sends it. */
export const confirmIntentAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.intents.confirm({ params: { id: request.id }, payload: { credential } })
  })
)

/** Prepares a draft's lock again. */
export const lockAgentAtom = BluechipApiClient.mutation("agents", "lock")

/** Prepares a change of an agent's policies again. */
export const changeAgentAtom = BluechipApiClient.mutation("agents", "change")

/** Prepares an agent's renewal again. */
export const renewAgentAtom = BluechipApiClient.mutation("agents", "renew")

/** Prepares an agent's removal again. */
export const removeAgentAtom = BluechipApiClient.mutation("agents", "remove")

/** Signs a prepared lock, change, renewal or removal with the account's passkey (Face ID) and sends it. */
export const confirmAgentAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.agents.confirm({ params: { id: request.id }, payload: { credential } })
  })
)
