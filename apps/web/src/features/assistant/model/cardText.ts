// How cards read: why a confirm or a Face ID didn't go, and what a memory is.
import type { AgentStatus } from "@bluechip/domain/agents/Agent"
import type { MemoryKind } from "@bluechip/domain/assistant/Memory"
import { Conflict, InvalidAutomation, InvalidSpec, Unavailable } from "@bluechip/domain/Errors"
import * as DateTime from "effect/DateTime"
import { passkeyProblem } from "../../../lib/passkeyProblem.ts"
import { unavailableProblem } from "../../../lib/unavailableProblem.ts"

/** Why confirming or dismissing a card didn't go, in words. */
export const cardProblem = (error: unknown): string => {
  if (error instanceof Conflict) return "This was already answered, so there's nothing left to do."
  if (error instanceof InvalidSpec || error instanceof InvalidAutomation) {
    return error.problems.map((problem) => problem.message).join(" ")
  }
  return "We couldn't reach bluechip just now. Nothing changed, so try again."
}

/** Why a Face ID request for an agent didn't start or finish: nothing changed onchain in any of these. */
export const signingProblem = (error: unknown): string => {
  if (error instanceof InvalidSpec) return error.problems.map((problem) => problem.message).join(" ")
  if (error instanceof Conflict) return "This agent has another change on its way. Try again once it lands."
  if (error instanceof Unavailable) return unavailableProblem(error)
  return passkeyProblem(error, "Nothing changed.").text
}

/** Whether a prepared request has run out (they last two minutes), so it must be prepared again before signing. */
export const hasExpired = (expiresAt: DateTime.Utc): boolean => DateTime.toEpochMillis(expiresAt) <= Date.now()

export const MEMORY_KIND: Readonly<Record<MemoryKind, string>> = {
  preference: "Preference",
  constraint: "Rule",
  goal: "Goal",
  fact: "Fact"
}

/** What an agent card's Face ID did: lock a draft, or change, renew or remove an agent. */
export type AgentCardAction = "lock" | "update" | "renew" | "remove"

const LANDED: Readonly<Record<AgentCardAction, (name: string) => string>> = {
  lock: (name) => `${name} is live`,
  update: (name) => `${name}'s new rules are locked`,
  renew: (name) => `${name} is renewed`,
  remove: (name) => `${name} is removed`
}

/**
 * An agent card's end once signed, from where the agent stands: a short wait while Base takes it, then what landed;
 * `null` while there's nothing to say (still a draft, or back where it was).
 */
export const agentOutcome = (
  action: AgentCardAction,
  status: AgentStatus,
  name: string
): { readonly tone: "pending" | "success"; readonly title: string; readonly description: string } | null => {
  if (status === "locking" || status === "updating" || status === "removing") {
    const doing = action === "remove" ? `Removing ${name}` : action === "lock" ?
      `Locking ${name}'s rules` :
      action === "renew"
      ? `Renewing ${name}`
      : `Changing ${name}'s rules`
    return { tone: "pending", title: doing, description: "Base takes a couple of seconds." }
  }
  const landed = action === "remove" ? status === "removed" : status === "active"
  if (!landed) return null
  return {
    tone: "success",
    title: LANDED[action](name),
    description: action === "remove" ? "Your stocks and cash stay in your account." : "It trades inside its rules."
  }
}
