// The moment an agent's change lands, said once on its page: it went live, its new rules are locked, it was renewed,
// it's trading again. Base takes a couple of seconds, so these replace any step tracker. Pausing needs no moment: the
// paused alert says it.
import type { Agent } from "@bluechip/domain/agents/Agent"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { dayLabel } from "./fieldText.ts"

/** `removed` is only handed over to the list, since a removed agent's page goes back to it. */
export type AgentMoment = "live" | "changed" | "renewed" | "resumed" | "removed"

/** Where an agent stood, enough to tell which moment its next state is. */
export interface AgentSnapshot {
  readonly status: Agent["status"]
  readonly paused: boolean
  /** A change on its way that locks the same policies again: a renewal. */
  readonly renewing: boolean
}

export const snapshotOf = (agent: Agent): AgentSnapshot => ({
  status: agent.status,
  paused: agent.paused,
  renewing: agent.pendingSpec !== null && compareSpecs(agent.spec, agent.pendingSpec).policies.length === 0
})

/** The moment between two states of the same agent, or `null` when nothing landed. */
export const agentMoment = (before: AgentSnapshot, after: AgentSnapshot): AgentMoment | null => {
  if (after.status !== "active") return null
  if (before.status === "locking") return "live"
  if (before.status === "updating") return before.renewing ? "renewed" : "changed"
  if (before.paused && !after.paused) return "resumed"
  return null
}

/** What the moment says: a title naming the agent, and one line on what it means now. */
export const momentText = (
  moment: AgentMoment,
  agent: Pick<Agent, "name" | "lockedUntil">
): { readonly title: string; readonly description: string } => {
  const until = agent.lockedUntil === null ? null : dayLabel(agent.lockedUntil)
  switch (moment) {
    case "live":
      return { title: `${agent.name} is live`, description: "It trades inside its rules from now on." }
    case "changed":
      return { title: `${agent.name}'s new rules are locked`, description: "They apply to its next trade." }
    case "renewed":
      return {
        title: `${agent.name} is renewed`,
        description: until === null ? "Same rules, new key." : `Same rules, locked until ${until}.`
      }
    case "resumed":
      return { title: `${agent.name} is trading again`, description: "It trades inside its rules." }
    case "removed":
      return {
        title: `${agent.name} is removed`,
        description: "It can never trade again. Your stocks and cash stay yours."
      }
  }
}
