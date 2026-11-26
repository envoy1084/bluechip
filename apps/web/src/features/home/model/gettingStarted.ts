// Where someone is with bluechip: just arrived (nothing yet), getting started (a checklist of first steps, ticked
// from what they've really done), or settled in. Each step says what to do; the first one left is the next.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentId } from "@bluechip/domain/Ids"

export type StepId = "cash" | "agent" | "trade" | "automation" | "recovery"

export interface Step {
  readonly id: StepId
  readonly title: string
  readonly detail: string
  readonly done: boolean
  /** The agent the step is about: a draft to finish, or the agent whose first trade it waits for. */
  readonly agentId?: AgentId
}

/** What someone has done so far, read from their money, agents, trades, automations and recovery. */
export interface SetupFacts {
  readonly hasMoney: boolean
  /** Every agent, oldest first, removed ones included. */
  readonly agents: ReadonlyArray<Pick<Agent, "id" | "name" | "status">>
  /** Whether any agent's trade has gone through. */
  readonly agentTraded: boolean
  readonly hasAutomation: boolean
  readonly hasRecoveryKey: boolean
  readonly signedUpAt: Date
}

/** Just arrived (no money, no agents), getting started, or settled in. */
export type Stage = "welcome" | "starting" | "settled"

const STARTING_DAYS = 30

/** The five first steps, in order, each ticked from what has really happened. */
export const setupSteps = (facts: SetupFacts): ReadonlyArray<Step> => {
  const draft = facts.agents.find((agent) => agent.status === "draft")
  const locked = facts.agents.find((agent) => agent.status !== "draft")
  const trading = facts.agents.find((agent) => agent.status !== "draft" && agent.status !== "removed")

  return [
    {
      id: "cash",
      title: "Add cash",
      detail: "Send USDC on Base. It's yours to invest or take out at any time.",
      done: facts.hasMoney
    },
    {
      id: "agent",
      title: "Create your first agent",
      detail: locked === undefined && draft !== undefined ?
        `${draft.name} is a draft. Lock its rules with Face ID to start it.` :
        "Pick a template and set its limits. It can only trade inside them.",
      done: locked !== undefined,
      ...(locked === undefined && draft !== undefined ? { agentId: draft.id } : {})
    },
    {
      id: "trade",
      title: "Let it make a first trade",
      detail: "It trades when its rules and the market allow, or when you ask it to.",
      done: facts.agentTraded,
      ...(trading === undefined ? {} : { agentId: trading.id })
    },
    {
      id: "automation",
      title: "Set up an automation",
      detail: "Buy every week or sell on a drop, even while you're away.",
      done: facts.hasAutomation
    },
    {
      id: "recovery",
      title: "Add a recovery key",
      detail: "A second passkey, on another device or a hardware key, gets you back in if you lose this one.",
      done: facts.hasRecoveryKey
    }
  ]
}

/** The first step left, the one to do next; `undefined` once all are done. */
export const nextStep = (steps: ReadonlyArray<Step>): Step | undefined => steps.find((step) => !step.done)

/**
 * Welcome with nothing yet; getting started while money, a first agent or its first trade is missing, or for the
 * first 30 days while any step is; settled after that, when what's left becomes a reminder instead.
 */
export const stageOf = (facts: SetupFacts, now: Date): Stage => {
  if (!facts.hasMoney && facts.agents.every((agent) => agent.status === "removed")) return "welcome"

  const steps = setupSteps(facts)
  if (steps.every((step) => step.done)) return "settled"

  const core = steps.filter((step) => step.id === "cash" || step.id === "agent" || step.id === "trade")
  const young = now.getTime() - facts.signedUpAt.getTime() < STARTING_DAYS * 86_400_000
  return young || core.some((step) => !step.done) ? "starting" : "settled"
}
