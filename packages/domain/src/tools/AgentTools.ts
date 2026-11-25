/**
 * Tools over your agents: reading them (read), pausing and resuming them (configure, a card you confirm), and
 * drafting, changing, renewing or removing them (sign, a card only your Face ID completes).
 *
 * @since 0.0.0
 */
import * as Tool from "effect/ai/Tool"
import * as Schema from "effect/Schema"
import { Agent, AgentName, AgentSession, AgentUsage } from "../agents/Agent.ts"
import { Card, describeCard } from "../assistant/Card.ts"
import { AgentId, IntentId } from "../Ids.ts"
import { Intent } from "../intents/Intent.ts"
import { SpecDescription } from "../policies/Catalog.ts"
import { listNames } from "../policies/Format.ts"
import { Caller, ToolProblem } from "./Caller.ts"
import { Risk } from "./Risk.ts"
import { SpecDraft, SpecPatch } from "./SpecPatch.ts"
import { say, usd } from "./Words.ts"

const AgentParameters = Schema.Struct({
  agentId: AgentId.annotate({ description: "The agent's id (agent_…), from listAgents." })
})

const stocksOf = (agent: Agent): ReadonlyArray<string> => {
  const trade = agent.spec.policies.find((entry) => entry.id === "trade")
  return trade?.id === "trade" ? trade.config.stocks : []
}

const cardOutput = (card: Card) => say(describeCard(card))

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ListAgents = Tool.make("listAgents", {
  description: "The user's agents: id, name, status, whether paused, and the stocks each trades.",
  success: Schema.Array(Agent),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (agents) =>
    say(
      agents.length === 0 ?
        "The user has no agents yet." :
        agents.map((agent) =>
          `${agent.id} "${agent.name}": ${agent.status}${agent.paused ? ", paused" : ""}, ` +
          `trades ${listNames(stocksOf(agent))}`
        )
    )
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetAgent = Tool.make("getAgent", {
  description: "One agent and its policies in words: what it can do on its own and what it never does.",
  parameters: AgentParameters,
  success: Schema.Struct({ agent: Agent, description: SpecDescription }),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: ({ agent, description }) =>
    say([
      `${agent.id} "${agent.name}": ${agent.status}${agent.paused ? ", paused" : ""}.`,
      "It can:",
      ...description.can.map((line) => `- ${line}`),
      "It never:",
      ...description.never.map((line) => `- ${line}`)
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetAgentUsage = Tool.make("getAgentUsage", {
  description: "What an agent has used of its limits, read from its policies onchain: today's budget, trades today, " +
    "this week's slippage and gas.",
  parameters: AgentParameters,
  success: AgentUsage,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: (usage) =>
    say(usage.policies.map((policy) => {
      const amount = (value: bigint) => policy.unit === "usd" ? usd(value) : String(value)
      return `${policy.policy}: ${amount(policy.used)} used` +
        (policy.limit === null ? "" : ` of ${amount(policy.limit)} (${policy.unit})`)
    }))
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const GetAgentHistory = Tool.make("getAgentHistory", {
  description: "An agent's sessions (each lock, change and renewal of its policies) and its latest 10 trades.",
  parameters: AgentParameters,
  success: Schema.Struct({ sessions: Schema.Array(AgentSession), intents: Schema.Array(Intent) }),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: ({ intents, sessions }) =>
    say([
      ...sessions.map((session) => `Session ${session.id}: ${session.status}, by ${session.createdBy}`),
      ...intents.map((intent) => `Trade ${intent.id}: ${intent.leg.side} ${intent.leg.symbol}, ${intent.status}`)
    ])
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ExplainDecision = Tool.make("explainDecision", {
  description: "Why a trade was blocked, is waiting or needs approval, in words, with the policy that decided it.",
  parameters: Schema.Struct({ intentId: IntentId }),
  success: Schema.Struct({ intent: Intent, explanation: Schema.String }),
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: ({ explanation, intent }) => say(`${intent.id} is ${intent.status}. ${explanation}`)
}).annotate(Risk, "read")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const PauseAgent = Tool.make("pauseAgent", {
  description: "Shows a card to pause an agent: once the user confirms, bluechip sends none of its trades. Its " +
    "policies stay locked onchain.",
  parameters: AgentParameters,
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ResumeAgent = Tool.make("resumeAgent", {
  description: "Shows a card to resume a paused agent, applied once the user confirms.",
  parameters: AgentParameters,
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const PauseAll = Tool.make("pauseAll", {
  description: "Shows a card to pause every agent at once, applied once the user confirms.",
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "configure")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const DraftAgent = Tool.make("draftAgent", {
  description: "Drafts a new agent from a template and preset, with the user's stocks and any policy changes, and " +
    "shows it as a card. It is locked onchain only when the user approves it with Face ID; check it with " +
    "checkAgentSpec first when unsure.",
  parameters: Schema.Struct({ name: AgentName, draft: SpecDraft }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "sign")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const ChangeAgentPolicies = Tool.make("changeAgentPolicies", {
  description: "Prepares a change to an active agent's policies and shows what changes as a card; the user signs it " +
    "with Face ID.",
  parameters: Schema.Struct({ agentId: AgentId, changes: SpecPatch }),
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "sign")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const RenewAgent = Tool.make("renewAgent", {
  description: "Prepares a renewal of an agent's session (a new key, the same policies, 90 more days) as a card the " +
    "user signs with Face ID.",
  parameters: AgentParameters,
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "sign")

/**
 * @stability unstable
 * @category tools
 * @since 0.0.0
 */
export const RemoveAgent = Tool.make("removeAgent", {
  description: "Prepares the removal of an agent (revoking its session onchain) as a card the user signs with Face " +
    "ID. A draft is removed at once.",
  parameters: AgentParameters,
  success: Card,
  failure: ToolProblem,
  failureMode: "return",
  dependencies: [Caller],
  toModelOutput: cardOutput
}).annotate(Risk, "sign")
