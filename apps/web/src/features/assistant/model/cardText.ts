// How cards read: why a confirm or a Face ID didn't go, and what a memory is.
import type { AgentStatus } from "@bluechip/domain/agents/Agent"
import type { MemoryKind } from "@bluechip/domain/assistant/Memory"
import { Conflict, InvalidSpec, Unavailable } from "@bluechip/domain/Errors"
import * as DateTime from "effect/DateTime"
import { unavailableProblem } from "../../../lib/unavailableProblem.ts"

/** Why confirming or dismissing a card didn't go, in words. */
export const cardProblem = (error: unknown): string => {
  if (error instanceof Conflict) return "This was already answered, so there's nothing left to do."
  if (error instanceof InvalidSpec) return error.problems.map((problem) => problem.message).join(" ")
  return "We couldn't reach bluechip just now. Nothing changed, so try again."
}

/** Why a Face ID request for an agent didn't start or finish: nothing changed onchain in any of these. */
export const signingProblem = (error: unknown): string => {
  if (error instanceof InvalidSpec) return error.problems.map((problem) => problem.message).join(" ")
  if (error instanceof Conflict) return "This agent has another change on its way. Try again once it lands."
  if (error instanceof Unavailable) return unavailableProblem(error)
  return "Face ID was cancelled or the request couldn't be sent. Nothing changed."
}

/** Whether a prepared request has run out (they last two minutes), so it must be prepared again before signing. */
export const hasExpired = (expiresAt: DateTime.Utc): boolean => DateTime.toEpochMillis(expiresAt) <= Date.now()

export const MEMORY_KIND: Readonly<Record<MemoryKind, string>> = {
  preference: "Preference",
  constraint: "Rule",
  goal: "Goal",
  fact: "Fact"
}

/** Where an agent on a card stands. */
export const AGENT_STANDING: Readonly<Record<AgentStatus, string>> = {
  draft: "Not running yet",
  locking: "Locking on Base",
  active: "Running",
  updating: "Changing on Base",
  removing: "Being removed",
  expired: "Ran out, renew it to keep it running",
  removed: "Removed"
}
