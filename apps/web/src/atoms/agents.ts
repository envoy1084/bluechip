import { agentsReactivityKey, BluechipApiClient, liveReactivityKey } from "../lib/api/client.ts"

/** The user's agents, oldest first; refetched on every `AgentChanged`. */
export const agentsAtom = BluechipApiClient.query("agents", "list", {
  reactivityKeys: [agentsReactivityKey, liveReactivityKey]
})

/** Pauses every agent at once. */
export const pauseAllAgentsAtom = BluechipApiClient.mutation("agents", "pauseAll")

/** Resumes every paused agent. */
export const resumeAllAgentsAtom = BluechipApiClient.mutation("agents", "resumeAll")
