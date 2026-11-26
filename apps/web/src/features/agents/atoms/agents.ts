import type { AgentId, SigningRequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import {
  agentsReactivityKey,
  automationsReactivityKey,
  BluechipApiClient,
  intentsReactivityKey,
  liveReactivityKey,
  usageReactivityKey
} from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

const reactivityKeys = [agentsReactivityKey, liveReactivityKey]

/** One agent, removed ones included. */
export const agentAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "agent", { params: { id }, reactivityKeys })
)

/** What an agent has used, policy by policy, read from its session onchain; refetched when its trades fill. */
export const agentUsageAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "usage", {
    params: { id },
    reactivityKeys: [...reactivityKeys, usageReactivityKey]
  })
)

/** The size of a page of an agent's journal. */
export const journalPageSize = 20

/** A page of an agent's journal, newest first: `"<agentId> <pageToken>"`, the token empty for the first page. */
export const agentJournalAtom = Atom.family((key: string) => {
  const [id, pageToken = ""] = key.split(" ") as [AgentId, string?]
  return BluechipApiClient.query("agents", "journal", {
    params: { id },
    query: { pageSize: journalPageSize, ...(pageToken === "" ? {} : { pageToken }) },
    reactivityKeys: [...reactivityKeys, intentsReactivityKey]
  })
})

/**
 * The journal's pages loaded so far, read together so the page can tell them as one story:
 * `"<agentId> <pageToken> <pageToken>…"`, the first token empty.
 */
export const agentJournalPagesAtom = Atom.family((key: string) => {
  const [id, ...pageTokens] = key.split(" ")
  return Atom.make((get) => pageTokens.map((pageToken) => get(agentJournalAtom(`${id} ${pageToken}`))))
})

/** An agent's automations, so its journal can say what set each run off. */
export const agentAutomationsAtom = Atom.family((agentId: AgentId) =>
  BluechipApiClient.query("automations", "list", {
    query: { agentId },
    reactivityKeys: [automationsReactivityKey, liveReactivityKey]
  })
)

/** An agent's sessions, newest first: each set of policies locked for it, and how long it lasted. */
export const agentSessionsAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "sessions", { params: { id }, reactivityKeys })
)

/** Creates a draft agent and prepares its lock for the passkey. */
export const createAgentAtom = BluechipApiClient.mutation("agents", "create")

/** Prepares a draft's lock again (after one that failed or expired). */
export const lockAgentAtom = BluechipApiClient.mutation("agents", "lock")

/** Prepares a change of a locked agent's policies (a new session) for the passkey. */
export const changeAgentAtom = BluechipApiClient.mutation("agents", "change")

/** Prepares a new session with the same policies (a new key, 90 more days) for the passkey. */
export const renewAgentAtom = BluechipApiClient.mutation("agents", "renew")

/** Removes a draft at once, or prepares the revocation of a locked agent's session for the passkey. */
export const removeAgentAtom = BluechipApiClient.mutation("agents", "remove")

/** Stops bluechip sending an agent's trades; its lock stays. */
export const pauseAgentAtom = BluechipApiClient.mutation("agents", "pause")

export const resumeAgentAtom = BluechipApiClient.mutation("agents", "resume")

/** Signs a prepared lock, change, renewal or removal with the account's passkey (Face ID) and sends it. */
export const confirmAgentAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.agents.confirm({
      params: { id: request.id },
      payload: { credential }
    })
  })
)

/** An agent's last filled trade (a page of one), refetched as its trades change. */
export const agentLastTradeAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("intents", "list", {
    query: { agentId: id, status: "filled", pageSize: 1 },
    reactivityKeys: [...reactivityKeys, intentsReactivityKey]
  })
)

/**
 * The list's reads of several agents at once, in order: each one's usage and last filled trade, keyed by their ids
 * joined with spaces (`"<agentId> <agentId>…"`).
 */
export const agentsAtAGlanceAtom = Atom.family((key: string) => {
  const ids = key.split(" ").filter((id) => id !== "") as Array<AgentId>
  return Atom.make((get) =>
    ids.map((id) => ({ id, usage: get(agentUsageAtom(id)), lastTrade: get(agentLastTradeAtom(id)) }))
  )
})
