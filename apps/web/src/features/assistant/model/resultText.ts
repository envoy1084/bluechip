// How each result card reads: its title and icon, what it says when its tool found nothing, and when it failed.
import type { Agent, AgentStatus } from "@bluechip/domain/agents/Agent"
import type { Intent, IntentStatus } from "@bluechip/domain/intents/Intent"
import type { AgentStatus as AvatarStatus } from "@bluechip/ui/bluechip/agent-avatar"
import type { IconName } from "@bluechip/ui/icons/icon"
import type { ReadTool } from "./readResult.ts"

export interface ResultLook {
  readonly title: string
  readonly icon: IconName
  /** What it says when the tool found nothing. */
  readonly empty: string
  /** The start of what it says when the tool failed: "Couldn't read your portfolio". */
  readonly failed: string
}

export const RESULT_LOOK: Readonly<Record<ReadTool, ResultLook>> = {
  getPortfolio: {
    title: "Your portfolio",
    icon: "portfolio",
    empty: "Nothing in your account yet. Add USDC on Base to buy your first stock.",
    failed: "Couldn't read your portfolio"
  },
  getPerformance: {
    title: "How you're doing",
    icon: "chart-line",
    empty: "No trades yet, so there's nothing to add up.",
    failed: "Couldn't read how you're doing"
  },
  getStock: { title: "Stock", icon: "stocks", empty: "No price right now.", failed: "Couldn't look up the stock" },
  getStockFacts: {
    title: "Stock",
    icon: "stocks",
    empty: "No facts for this stock.",
    failed: "Couldn't look up the stock's facts"
  },
  getStockPerformance: {
    title: "Stock",
    icon: "stocks",
    empty: "You haven't traded it yet.",
    failed: "Couldn't read your results in the stock"
  },
  getPrices: { title: "Prices", icon: "chart-up", empty: "No stocks to price.", failed: "Couldn't check prices" },
  getQuote: { title: "Quote", icon: "receipt", empty: "No quote.", failed: "Couldn't get a quote" },
  getAgent: { title: "Agent", icon: "agent", empty: "No agent.", failed: "Couldn't read the agent" },
  listAgents: {
    title: "Your agents",
    icon: "agents",
    empty: "No agents yet. Ask me to make one, or start from a template.",
    failed: "Couldn't read your agents"
  },
  getAgentUsage: {
    title: "Today's usage",
    icon: "timer",
    empty: "Nothing counted yet today.",
    failed: "Couldn't read what the agent has used"
  },
  getAgentPerformance: {
    title: "Agent's results",
    icon: "chart-line",
    empty: "No trades yet, so there's nothing to add up.",
    failed: "Couldn't read the agent's results"
  },
  getActivity: {
    title: "Recent activity",
    icon: "activity",
    empty: "Nothing in this period.",
    failed: "Couldn't read your activity"
  },
  getAgentHistory: {
    title: "Its trades",
    icon: "activity",
    empty: "No trades yet.",
    failed: "Couldn't read the agent's history"
  },
  getAgentJournal: {
    title: "Its journal",
    icon: "book",
    empty: "Nothing in its journal yet.",
    failed: "Couldn't read the agent's journal"
  },
  explainDecision: {
    title: "Why it was decided",
    icon: "shield",
    empty: "No decision yet.",
    failed: "Couldn't look into the decision"
  },
  listAutomations: {
    title: "Automations",
    icon: "zap",
    empty: "No automations yet. Ask me for one, like a weekly buy.",
    failed: "Couldn't read your automations"
  },
  getAutomationPerformance: {
    title: "Automation's results",
    icon: "zap",
    empty: "It hasn't run yet.",
    failed: "Couldn't read the automation's results"
  },
  listTemplates: {
    title: "Templates",
    icon: "layers",
    empty: "No templates.",
    failed: "Couldn't read the templates"
  },
  listPolicies: { title: "Policies", icon: "shield", empty: "No policies.", failed: "Couldn't read the policies" },
  listMemories: {
    title: "What I remember",
    icon: "book",
    empty: "Nothing remembered yet.",
    failed: "Couldn't read what I remember"
  },
  searchMemory: {
    title: "From before",
    icon: "search",
    empty: "Nothing found from before.",
    failed: "Couldn't search what I remember"
  },
  searchHelp: {
    title: "From bluechip's help",
    icon: "help",
    empty: "Nothing in bluechip's help answers that.",
    failed: "Couldn't search bluechip's help"
  },
  proposeRebalance: {
    title: "Rebalance",
    icon: "scales",
    empty: "Nothing has drifted past its trigger, so there's nothing to trade.",
    failed: "Couldn't plan the rebalance"
  }
}

/** What a failed card says: "Couldn't read your portfolio. Base didn't answer in time." */
export const failedText = (tool: ReadTool, problem: string | null): string => {
  const start = RESULT_LOOK[tool].failed
  if (problem === null || problem.trim() === "") return `${start} just now. Try again in a moment.`
  const said = problem.trim()
  return `${start}. ${/[.!?]$/u.test(said) ? said : `${said}.`}`
}

/** A trade's standing as a short pill, for the cards' rows. */
export const INTENT_STATUS: Readonly<Record<IntentStatus, { readonly label: string; readonly tone: string }>> = {
  proposed: { label: "Asked", tone: "bg-g-100 text-g-600" },
  deciding: { label: "Checking", tone: "bg-g-100 text-g-600" },
  needsApproval: { label: "Needs you", tone: "bg-warn-wash text-warn" },
  awaitingSignature: { label: "Needs Face ID", tone: "bg-warn-wash text-warn" },
  sending: { label: "Sending", tone: "bg-g-100 text-g-600" },
  confirming: { label: "Confirming", tone: "bg-g-100 text-g-600" },
  filled: { label: "Filled", tone: "bg-gain-wash text-gain" },
  failed: { label: "Failed", tone: "bg-loss-wash text-loss" },
  blocked: { label: "Blocked", tone: "bg-loss-wash text-loss" },
  waiting: { label: "Waiting", tone: "bg-warn-wash text-warn" },
  declined: { label: "Declined", tone: "bg-g-100 text-g-600" },
  expired: { label: "Ran out", tone: "bg-g-100 text-g-600" },
  cancelled: { label: "Cancelled", tone: "bg-g-100 text-g-600" }
}

/** Whether a trade waits for you: over its agent's largest trade, or approved and waiting for Face ID. */
export const waitsForYou = (intent: Pick<Intent, "status">): boolean =>
  intent.status === "needsApproval" || intent.status === "awaitingSignature"

const STANDING: Readonly<Record<AgentStatus, string>> = {
  draft: "Draft",
  locking: "Locking",
  active: "Running",
  updating: "Changing",
  removing: "Removing",
  expired: "Ran out",
  removed: "Removed"
}

/** Where an agent stands in a word or two, a pause first: "Running", "Paused", "Ran out". */
export const agentStanding = (agent: Pick<Agent, "status" | "paused">): string =>
  agent.paused && agent.status === "active" ? "Paused" : STANDING[agent.status]

/** The dot on its butterfly: green while it runs, amber paused, grey otherwise. */
export const agentDot = (agent: Pick<Agent, "status" | "paused">): AvatarStatus =>
  agent.status !== "active" ? "idle" : agent.paused ? "paused" : "active"

/** When the daily limits start again, from `now`: "Starts again at midnight UTC, in 5 h 20 min". */
export const resetText = (now: Date): string => {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  const minutes = Math.max(1, Math.ceil((midnight - now.getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const left = hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
  return `Starts again at midnight UTC, in ${left}`
}
