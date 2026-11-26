// An agent's state between the domain (`Agent`: where its onchain session stands, paused or not) and the states
// `@bluechip/ui` shows (`AgentState`), plus the two the kit has no word for: a draft not locked yet, and a lock,
// change or removal on its way to Base.
import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { formatDollars } from "@bluechip/domain/policies/Format"
import type { AgentStatus as AvatarStatus } from "@bluechip/ui/bluechip/agent-avatar"
import { AGENT_STATES, type AgentState } from "@bluechip/ui/bluechip/agent-status"
import * as DateTime from "effect/DateTime"

export type AgentDisplayState = AgentState | "unlocked" | "sending"

/** Whether its session is locked onchain, so it has usage to read. */
export const hasSession = (agent: Agent): boolean =>
  agent.status === "active" || agent.status === "updating" || agent.status === "removing"

// Any counted policy at its limit stops the agent for the day; a sell-only agent's daily budget of 0 never counts.
const usedUp = (counted: AgentUsage["policies"][number]): boolean =>
  counted.limit !== null && counted.limit > BigInt(0) && counted.used >= counted.limit

/** What the agent is doing now; with its usage, whether today's limit stopped it. */
export const agentState = (agent: Agent, now: Date, usage?: AgentUsage): AgentDisplayState => {
  if (agent.status === "removed") return "removed"
  if (agent.status === "draft") return "unlocked"
  if (agent.status === "expired") return "expired"
  if (agent.status !== "active") return "sending"
  if (agent.paused) return "paused"
  if (agent.lockedUntil !== null && DateTime.toEpochMillis(agent.lockedUntil) <= now.getTime()) return "expired"
  if (usage !== undefined && usage.policies.some(usedUp)) return "stopped"
  return "active"
}

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

/**
 * Why a stopped agent is done for today, and when it starts again: the limit it used up (its budget, trades or gas),
 * then the next midnight UTC (when its onchain limits reset) in the viewer's own time. `null` when no limit is used up.
 */
export const limitLine = (usage: AgentUsage, now: Date): string | null => {
  const used = usage.policies.find(usedUp)
  if (used === undefined) return null

  const what = used.policy === "trade" ?
    `Used today's ${formatDollars(used.limit!)} budget.` :
    used.policy === "tradesPerDay" ?
    `Made all ${used.limit} of today's trades.` :
    "Used today's gas budget."
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return `${what} Starts again at ${clock.format(reset)} your time, midnight UTC.`
}

/** The dot on the agent's avatar for its state. */
export const agentDot = (state: AgentDisplayState): AvatarStatus => {
  if (state === "unlocked") return "idle"
  if (state === "sending") return "waiting"
  return AGENT_STATES[state].dot
}
