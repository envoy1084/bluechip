import type { AgentId, SigningRequestId } from "@bluechip/domain/Ids"
import type { AuthenticationCredential } from "@bluechip/domain/WebAuthn"
import { startAuthentication } from "@simplewebauthn/browser"
import * as Effect from "effect/Effect"
import * as Atom from "effect/reactivity/Atom"
import { agentsReactivityKey, BluechipApiClient, liveReactivityKey } from "../api/client.ts"
import { asCredential, ceremonyOptions } from "./account.ts"

const reactivityKeys = [agentsReactivityKey, liveReactivityKey]

/** The user's agents, oldest first; refetched on every `AgentChanged`. */
export const agentsAtom = BluechipApiClient.query("agents", "list", { reactivityKeys })

/** One agent, removed ones included. */
export const agentAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "agent", { params: { id }, reactivityKeys })
)

/** What an agent has used today and this week, read from its session onchain. */
export const agentUsageAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "usage", { params: { id }, reactivityKeys })
)

/** Creates a draft agent and prepares its lock for the passkey. */
export const createAgentAtom = BluechipApiClient.mutation("agents", "create")

/** Prepares a draft's lock again (after one that failed or expired). */
export const lockAgentAtom = BluechipApiClient.mutation("agents", "lock")

/** Prepares a change of a locked agent's limits for the passkey. */
export const changeLimitsAtom = BluechipApiClient.mutation("agents", "changeLimits")

/** Removes a draft at once, or prepares the revocation of a locked agent's session for the passkey. */
export const removeAgentAtom = BluechipApiClient.mutation("agents", "remove")

/** Stops bluechip sending an agent's trades; its lock stays. */
export const pauseAgentAtom = BluechipApiClient.mutation("agents", "pause")

export const resumeAgentAtom = BluechipApiClient.mutation("agents", "resume")

/** Pauses every agent at once. */
export const pauseAllAgentsAtom = BluechipApiClient.mutation("agents", "pauseAll")

/** Resumes every paused agent. */
export const resumeAllAgentsAtom = BluechipApiClient.mutation("agents", "resumeAll")

/** Signs a prepared lock, change or removal with the account's passkey (Face ID) and sends it. */
export const confirmAgentAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* Effect.tryPromise(() =>
      startAuthentication({ optionsJSON: ceremonyOptions(request.options) })
    )

    return yield* client.agents.confirm({
      params: { id: request.id },
      payload: { credential: asCredential<typeof AuthenticationCredential.Type>(credential) }
    })
  })
)
