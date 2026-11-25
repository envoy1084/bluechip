// An agent's state between the domain (`Agent`: where its onchain session stands, paused or not) and the states
// `@bluechip/ui` shows (`AgentState`), plus the two the kit has no word for: a draft not locked yet, and a lock,
// change or removal on its way to Base.
import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import type { AgentStatus as AvatarStatus } from "@bluechip/ui/bluechip/agent-avatar"
import { AGENT_STATES, type AgentState } from "@bluechip/ui/bluechip/agent-status"
import * as DateTime from "effect/DateTime"

export type AgentDisplayState = AgentState | "unlocked" | "sending"

/** Whether its session is locked onchain, so it has usage to read. */
export const hasSession = (agent: Agent): boolean =>
  agent.status === "active" || agent.status === "updating" || agent.status === "removing"

/** Whether bluechip can pause it: anything locked or on its way to be, not a draft or a removed agent. */
export const isPausable = (agent: Agent): boolean => agent.status !== "draft" && agent.status !== "removed"

// Any counted policy at its limit stops the agent for the day; a sell-only agent's daily budget of 0 never counts.
const limitReached = (usage: AgentUsage): boolean =>
  usage.policies.some((counted) => counted.limit !== null && counted.limit > BigInt(0) && counted.used >= counted.limit)

/** What the agent is doing now; with its usage, whether today's limit stopped it. */
export const agentState = (agent: Agent, now: Date, usage?: AgentUsage): AgentDisplayState => {
  if (agent.status === "removed") return "removed"
  if (agent.status === "draft") return "unlocked"
  if (agent.status !== "active") return "sending"
  if (agent.paused) return "paused"
  if (agent.lockedUntil !== null && DateTime.toEpochMillis(agent.lockedUntil) <= now.getTime()) return "expired"
  if (usage !== undefined && limitReached(usage)) return "stopped"
  return "active"
}

/** The dot on the agent's avatar for its state. */
export const agentDot = (state: AgentDisplayState): AvatarStatus => {
  if (state === "unlocked") return "idle"
  if (state === "sending") return "waiting"
  return AGENT_STATES[state].dot
}
