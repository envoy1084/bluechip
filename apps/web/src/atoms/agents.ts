import type { AgentId } from "@bluechip/domain/Ids"
import * as Atom from "effect/reactivity/Atom"
import { agentsReactivityKey, BluechipApiClient, liveReactivityKey, usageReactivityKey } from "../lib/api/client.ts"

/** The user's agents, oldest first; refetched on every `AgentChanged`. */
export const agentsAtom = BluechipApiClient.query("agents", "list", {
  reactivityKeys: [agentsReactivityKey, liveReactivityKey]
})

/** What an agent has used, policy by policy, read from its session onchain; refetched when its trades fill. */
export const agentUsageAtom = Atom.family((id: AgentId) =>
  BluechipApiClient.query("agents", "usage", {
    params: { id },
    reactivityKeys: [agentsReactivityKey, liveReactivityKey, usageReactivityKey]
  })
)

/** Pauses every agent at once. */
export const pauseAllAgentsAtom = BluechipApiClient.mutation("agents", "pauseAll")

/** Resumes every paused agent. */
export const resumeAllAgentsAtom = BluechipApiClient.mutation("agents", "resumeAll")
