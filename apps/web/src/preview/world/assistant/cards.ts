// Every card the assistant can show, in each state, by name: the panel adds them, replies and the scenario's threads
// make them. Each comes with the tool call that made it (none for the assistant's own cards) and what the assistant
// says before it.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Card, CardStatus } from "@bluechip/domain/assistant/Card"
import type { Memory } from "@bluechip/domain/assistant/Memory"
import type { AgentId, AutomationId, CardId } from "@bluechip/domain/Ids"
import { RESEARCH_TOOL } from "@bluechip/domain/tools/Toolkit"
import type { CastAgent, CastAutomation } from "../cast.ts"
import { agentControlCard, draftAgentCard, policyChangeCard, saveTemplateCard } from "./cards/agentCards.ts"
import { automationCard, automationControlCard, type DraftKind, draftOf } from "./cards/automationCards.ts"
import { approvalCard, tradeCard } from "./cards/tradeCards.ts"
import { agentOf, draftedAgent, nameOf } from "./castRecords.ts"
import { memoryOf } from "./memories.ts"
import type { Mint } from "./mint.ts"
import { own, type Round, say, searched, shows } from "./rounds.ts"

export const CARD_KINDS = [
  { id: "tradeSent", label: "Agent trade, sent", confirmable: false },
  { id: "tradeAsking", label: "Agent trade, needs your approval", confirmable: false },
  { id: "tradeBlocked", label: "Agent trade, blocked by a policy", confirmable: false },
  { id: "tradeWaiting", label: "Agent trade, waiting for prices", confirmable: false },
  { id: "approval", label: "Your trade, Face ID", confirmable: false },
  { id: "approvalExpired", label: "Your trade, request ran out", confirmable: false },
  { id: "draftAgent", label: "Draft agent with automations", confirmable: false },
  { id: "draftAgentPlain", label: "Draft agent without automations", confirmable: false },
  { id: "draftAgentLive", label: "Draft agent, now live", confirmable: false },
  { id: "policyUpdate", label: "Change an agent's policies", confirmable: false },
  { id: "policyRenew", label: "Renew an agent", confirmable: false },
  { id: "policyRemove", label: "Remove an agent", confirmable: false },
  { id: "policyRemoveDraft", label: "Draft removed", confirmable: false },
  { id: "pauseAgent", label: "Pause an agent", confirmable: true },
  { id: "resumeAgent", label: "Resume an agent", confirmable: true },
  { id: "pauseAll", label: "Pause every agent", confirmable: true },
  { id: "saveTemplate", label: "Save a template", confirmable: true },
  { id: "automationCreate", label: "New automation", confirmable: true },
  { id: "automationEdit", label: "Change an automation", confirmable: true },
  { id: "automationPause", label: "Pause an automation", confirmable: true },
  { id: "memoryConfirm", label: "Memory to confirm", confirmable: true },
  { id: "memorySaved", label: "Memory saved", confirmable: false },
  { id: "memoryForgotten", label: "Memory forgotten", confirmable: false },
  { id: "research", label: "Research with citations", confirmable: false },
  { id: "errorBudget", label: "Stopped: budget used", confirmable: false },
  { id: "errorRounds", label: "Stopped: too many steps", confirmable: false },
  { id: "errorCancelled", label: "Stopped: you cancelled", confirmable: false },
  { id: "errorInterrupted", label: "Stopped: connection dropped", confirmable: false },
  { id: "errorUnavailable", label: "Stopped: model unavailable", confirmable: false }
] as const

export type CardKind = (typeof CARD_KINDS)[number]["id"]

/** The server's words for a turn that stopped early. */
export const STOPPED = {
  budget: "You've used today's assistant budget, so I'll stop here. It resets at midnight UTC; " +
    "everything else in bluechip still works.",
  rounds: "That took more steps than I'm allowed in one go. Tell me what to do next and I'll carry on.",
  cancelled: "Stopped.",
  interrupted: "The connection dropped, so I stopped here. Ask again and I'll carry on.",
  unavailable: "The assistant can't answer right now. Nothing was changed. Try again in a moment."
} as const

interface MadeCard {
  readonly card: Card
  /** The tool call that made it; `null` for the assistant's own cards. */
  readonly tool: { readonly name: string; readonly params: unknown } | null
  /** What the assistant says before it. */
  readonly lead: string
  /** Memories the card is about, to keep in the world. */
  readonly memories: ReadonlyArray<Memory>
}

/** The automations the cast's kinds are drafted as. */
const DRAFT_OF: Readonly<Record<CastAutomation["kind"], DraftKind>> = {
  weeklyBuy: "weeklyBuy",
  monthlySplit: "weeklyBuy",
  rebalance: "weeklyBuy",
  stopLoss: "stopLoss",
  newsSell: "newsSell",
  priceAlert: "priceAlert"
}

/** A cast automation with the draft it reads as. */
export const castAutomationDraft = (mint: Mint, automation: CastAutomation) => {
  const agent = mint.cast.agents.find((candidate) => candidate.id === automation.agentId) ?? null
  return { id: automation.id, name: automation.name, draft: draftOf(DRAFT_OF[automation.kind], agent) }
}

/** The agent a card is about: the one asked for, else the cast's first live one, else a made-up picker. */
export const agentFor = (mint: Mint, focus: CastAgent | null): CastAgent =>
  focus ?? mint.cast.agents.find((agent) => agent.state === "active") ?? mint.cast.agents[0] ?? {
    id: "agent_01kqpv0000700890000000000z" as AgentId,
    name: "Tech picker",
    template: "stockPicker",
    preset: "balanced",
    stocks: ["NVDA", "AAPL"],
    targets: [],
    state: "draft",
    ageDays: 0
  }

const CITATIONS = [
  {
    url: "https://news.microsoft.com/source/fy26-q1-earnings",
    title: "Microsoft Cloud and AI strength drives first quarter results",
    citedText: "Azure and other cloud services revenue grew 39%."
  },
  {
    url: "https://www.reuters.com/technology/microsoft-capex-ai-2026",
    title: "Microsoft lifts AI spending again as data centre demand holds",
    citedText: null
  },
  {
    url: "https://www.ft.com/content/microsoft-openai-stake",
    title: "What Microsoft's new OpenAI terms mean for investors",
    citedText: "The company now holds roughly 27% of the restructured group."
  }
]

/** A card of `kind`, as `status` leaves it (for the cards that wait for you), about `focus` if given. */
export const makeCard = (mint: Mint, kind: CardKind, status: CardStatus, focus: CastAgent | null): MadeCard => {
  const cast = agentFor(mint, focus)
  const agent: Agent = mint.cast.agents.includes(cast) ? agentOf(mint, cast) : draftedAgent(mint, cast)
  const id = mint.id("card") as CardId
  const made = (card: Card, lead: string, tool: MadeCard["tool"], memories: ReadonlyArray<Memory> = []): MadeCard => ({
    card,
    tool,
    lead,
    memories
  })
  const trade = (outcome: Parameters<typeof tradeCard>[2], lead: string) => {
    const card = tradeCard(mint, cast, outcome)
    const leg = card._tag === "Trade" ? card.intent.leg : null
    return made(card, lead, {
      name: "proposeTrade",
      params: { agentId: cast.id, symbol: leg?.symbol, side: "buy", dollars: 50, shares: null, reason: "You asked." }
    })
  }
  const stopped = (reason: keyof typeof STOPPED, lead: string) =>
    made({ _tag: "Error", id, reason, message: STOPPED[reason] }, lead, null)

  switch (kind) {
    case "tradeSent":
      return trade("sent", `Done. ${cast.name} bought it within its policies.`)
    case "tradeAsking":
      return trade("asking", `That's over ${cast.name}'s largest trade, so it needs your approval.`)
    case "tradeBlocked":
      return trade("blocked", `${cast.name}'s policies refused this one.`)
    case "tradeWaiting":
      return trade("waiting", "Prices are paused while the market is closed, so this waits for them.")
    case "approval":
    case "approvalExpired": {
      const symbol = cast.stocks[0] ?? "AAPL"
      return made(
        approvalCard(mint, { symbol, dollars: 75, expired: kind === "approvalExpired" }),
        `Here's $75 of ${nameOf(symbol)} for you to approve. Nothing happens until you do.`,
        { name: "proposeTrade", params: { agentId: null, symbol, side: "buy", dollars: 75, shares: null } }
      )
    }
    case "draftAgent":
    case "draftAgentPlain":
    case "draftAgentLive": {
      const template = kind === "draftAgentPlain" ? "stockPicker" : "weeklyBuyer"
      const drafted = draftedAgent(
        mint,
        {
          name: kind === "draftAgentPlain" ? "Chip picker" : "Weekly Apple buyer",
          template,
          preset: "balanced",
          stocks: ["AAPL"],
          targets: []
        },
        kind === "draftAgentLive" ? "active" : "draft"
      )
      return made(
        draftAgentCard(
          mint,
          drafted,
          kind === "draftAgentLive" ? { started: [mint.id("automation") as AutomationId] } : {}
        ),
        `Here's ${drafted.name}. Look over what it can and can never do, then lock it with Face ID.`,
        {
          name: "draftAgent",
          params: { name: drafted.name, draft: { template, preset: "balanced", stocks: ["AAPL"] } }
        }
      )
    }
    case "policyUpdate":
    case "policyRenew":
    case "policyRemove":
    case "policyRemoveDraft": {
      const action = kind === "policyUpdate" ? "update" : kind === "policyRenew" ? "renew" : "remove"
      const target = kind === "policyRemoveDraft" ? draftedAgent(mint, { ...cast, name: "Amazon idea" }) : agent
      return made(
        policyChangeCard(mint, cast, target, action),
        action === "update" ?
          `Here's ${cast.name} with a smaller budget and largest trade.` :
          action === "renew" ?
          `This renews ${cast.name} for another 90 days.` :
          `This removes ${target.name}. Your stocks and cash stay where they are.`,
        { name: `${action === "update" ? "changeAgentPolicies" : `${action}Agent`}`, params: { agentId: target.id } }
      )
    }
    case "pauseAgent":
    case "resumeAgent":
    case "pauseAll": {
      const action = kind === "pauseAgent" ? "pause" : kind === "resumeAgent" ? "resume" : "pauseAll"
      const agents = action === "pauseAll" ?
        mint.cast.agents.map((candidate) => agentOf(mint, candidate)) :
        [action === "resume" ? agentOf(mint, { ...cast, state: "paused" }) : agent]
      return made(
        agentControlCard(mint, action, agents, status),
        action === "pauseAll" ?
          "This pauses every agent: nothing trades until you resume them." :
          `Confirm and ${cast.name} is ${action === "pause" ? "paused" : "running again"}.`,
        { name: action === "pauseAll" ? "pauseAll" : `${action}Agent`, params: { agentId: cast.id } }
      )
    }
    case "saveTemplate":
      return made(
        saveTemplateCard(mint, cast, `${cast.name} rules`, status),
        `I can save ${cast.name}'s policies as a template to start new agents from.`,
        { name: "saveTemplate", params: { name: `${cast.name} rules`, agentId: cast.id } }
      )
    case "automationCreate":
    case "automationEdit":
    case "automationPause": {
      const saved = mint.cast.automations[0]
      const existing = saved === undefined ? null : castAutomationDraft(mint, saved)
      if (kind === "automationPause" && existing !== null) {
        return made(
          automationControlCard(mint, "pause", existing, status),
          `Confirm and "${existing.name}" stops until you resume it.`,
          { name: "pauseAutomation", params: { automationId: existing.id } }
        )
      }
      const draft = existing?.draft ?? draftOf("stopLoss", cast)
      const editing = kind === "automationEdit" && existing !== null
      return made(
        automationCard(
          mint,
          editing ? existing.draft : kind === "automationCreate" ? draftOf("newsSell", cast) : draft,
          {
            status,
            automationId: editing ? existing.id : null
          }
        ),
        editing
          ? `Here's "${existing.name}" with your change.`
          : "Here it is in words. Nothing runs until you save it.",
        { name: "createAutomation", params: { automationId: editing ? existing.id : null } }
      )
    }
    case "memoryConfirm": {
      const memory = memoryOf(mint, {
        kind: "preference",
        // Each state a guess of its own: kept ones land in memory, and one guess shouldn't show there twice.
        text: status === "applied" ?
          "You prefer to keep about a fifth of your money in cash." :
          "You prefer to keep each stock under a quarter of your portfolio.",
        source: "inferred",
        confidence: 0.67,
        confirmedHoursAgo: status === "applied" ? 0 : null,
        hoursAgo: 0
      })
      return made(
        { _tag: "Memory", id, action: "confirm", memory, status },
        "",
        null,
        status === "dismissed" ? [] : [memory]
      )
    }
    case "memorySaved":
    case "memoryForgotten": {
      const memory = memoryOf(mint, {
        kind: "constraint",
        text: kind === "memorySaved" ? "You never want to own Tesla." : "You only buy on Mondays.",
        source: "said",
        confidence: 1,
        confirmedHoursAgo: 0,
        hoursAgo: 0
      })
      return made(
        { _tag: "Memory", id, action: kind === "memorySaved" ? "saved" : "forgotten", memory, status: "applied" },
        kind === "memorySaved" ? "Got it, I'll remember that." : "Done, I've forgotten that.",
        { name: kind === "memorySaved" ? "remember" : "forget", params: { text: memory.text } },
        kind === "memorySaved" ? [memory] : []
      )
    }
    case "research":
      return made(
        { _tag: "Research", id, query: "Microsoft latest quarter Azure growth", citations: CITATIONS },
        "Here's what I found on the web. Treat these pages as other people's views, not bluechip's.",
        { name: RESEARCH_TOOL, params: { query: "Microsoft latest quarter Azure growth" } }
      )
    case "errorBudget":
      return stopped("budget", "")
    case "errorRounds":
      return stopped("rounds", "I checked your agents, your portfolio and the prices")
    case "errorCancelled":
      return stopped("cancelled", "Looking at your Nvidia position, the first thing to")
    case "errorInterrupted":
      return stopped("interrupted", "Your portfolio is up this week, mostly from")
    case "errorUnavailable":
      return stopped("unavailable", "")
  }
}

/**
 * A made card as the round that shows it: what the assistant says, then the tool call that made it, or its own card
 * (research comes after the web search Anthropic ran).
 */
export const roundOf = (mint: Mint, made: MadeCard): Round => {
  const lead = made.lead === "" ? [] : [say(made.lead)]
  if (made.tool === null) return [...lead, own(made.card)]
  if (made.card._tag === "Research") {
    return [searched(mint, made.card.query, made.card.citations), ...lead, own(made.card)]
  }
  return [...lead, shows(mint, made.tool.name, made.tool.params, made.card)]
}
