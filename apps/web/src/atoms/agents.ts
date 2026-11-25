import type { AgentId, SigningRequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import { agentsReactivityKey, BluechipApiClient, liveReactivityKey, usageReactivityKey } from "../lib/api/client.ts"
import { signWithPasskey } from "../lib/passkey.ts"

const reactivityKeys = [agentsReactivityKey, liveReactivityKey]

/** The user's agents, oldest first; refetched on every `AgentChanged`. */
export const agentsAtom = BluechipApiClient.query("agents", "list", { reactivityKeys })

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

/** Pauses every agent at once. */
export const pauseAllAgentsAtom = BluechipApiClient.mutation("agents", "pauseAll")

/** Resumes every paused agent. */
export const resumeAllAgentsAtom = BluechipApiClient.mutation("agents", "resumeAll")

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
