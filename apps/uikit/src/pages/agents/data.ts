import type { Agent } from "@bluechip/ui/bluechip/agent-card"
import type { CitationSource } from "@bluechip/ui/bluechip/citation-chip"
import type { ProposalCardProps } from "@bluechip/ui/bluechip/proposal-card"
import { type AgentLimits, LIMIT_PRESETS } from "@bluechip/ui/lib/agent-limits"

export const AGENTS: ReadonlyArray<Agent> = [
  {
    id: "rebalancer",
    name: "Rebalancer",
    description: "Keeps your mix on target",
    state: "active",
    spentToday: 140,
    lockedUntil: "21 Feb",
    limits: {
      stocks: ["NVDA", "AAPL", "MSFT", "TSLA"],
      mode: "rebalance",
      dailySpend: 200,
      maxPerTrade: 100,
      maxInOneStock: 30,
      cashReserve: 10,
      approveAbove: 150
    }
  },
  {
    id: "picker",
    name: "Tech picker",
    description: "Trades Nvidia, Apple and Tesla",
    state: "needs-approval",
    spentToday: 410,
    lockedUntil: "3 Mar",
    limits: {
      stocks: ["NVDA", "AAPL", "TSLA"],
      mode: "buy-and-sell",
      dailySpend: 500,
      maxPerTrade: 250,
      maxInOneStock: 30,
      cashReserve: 10,
      approveAbove: 300
    }
  },
  {
    id: "weekly",
    name: "Weekly buyer",
    description: "Buys $50 of Microsoft every Monday",
    state: "stopped",
    spentToday: 50,
    lockedUntil: "1 Mar",
    limits: {
      stocks: ["MSFT"],
      mode: "buy",
      dailySpend: 50,
      maxPerTrade: 50,
      maxInOneStock: 25,
      cashReserve: 10,
      approveAbove: 100
    }
  },
  {
    id: "guard",
    name: "Stop-loss guard",
    description: "Sells Tesla if it drops 10%",
    state: "paused",
    spentToday: 0,
    lockedUntil: "21 Feb",
    limits: {
      stocks: ["TSLA"],
      mode: "sell",
      dailySpend: 0,
      maxPerTrade: 2500,
      maxInOneStock: 100,
      cashReserve: 0,
      approveAbove: 5000
    }
  }
]
export const [REBALANCER, PICKER, WEEKLY, GUARD] = AGENTS as [Agent, Agent, Agent, Agent]

export const LAST_ACTION: Readonly<Record<string, string>> = {
  rebalancer: "Sold $73.61 of Nvidia and bought Apple at 9:41",
  picker: "Wants to buy $600 of Nvidia, just now",
  weekly: "Bought $50 of Microsoft on Mon at 09:30",
  guard: "Watching Tesla, 4% above your stop, 2 min ago"
}

const BALANCED = LIMIT_PRESETS[1]!.limits
export const EDITOR_START: AgentLimits = { stocks: ["NVDA", "AAPL", "MSFT"], mode: "buy-and-sell", ...BALANCED }

export const SOURCES: ReadonlyArray<CitationSource> = [
  {
    kind: "Price",
    icon: "chart-line",
    from: "Price feed",
    title: "NVDA / USD on Base",
    when: "Updated 12 seconds ago"
  },
  {
    kind: "Filing",
    icon: "book",
    from: "Nvidia 10-Q",
    title: "Quarterly report, data center revenue",
    when: "19 Nov 2026"
  },
  {
    kind: "News",
    icon: "news",
    from: "Reuters",
    title: "Memory makers raise prices on AI demand",
    when: "23 Nov 2026"
  },
  { kind: "Account", icon: "wallet", from: "Your portfolio", title: "Holdings and limits", when: "Right now" }
]
export const [PRICE, FILING, NEWS, ACCOUNT] = SOURCES as [
  CitationSource,
  CitationSource,
  CitationSource,
  CitationSource
]

export const PROPOSAL: Omit<ProposalCardProps, "onApprove" | "onAdjust"> = {
  title: "AI chips and memory",
  holdings: [{ symbol: "NVDA", weight: 30, cappedFrom: 45 }, { symbol: "SNDK", weight: 30 }, {
    symbol: "MSFT",
    weight: 25
  }],
  unavailable: ["AMD", "TSM"],
  facts: [
    { text: "Nvidia gets most of its revenue from data center chips.", source: FILING },
    { text: "Memory prices rose this quarter as AI servers need more of it.", source: NEWS },
    { text: "Nvidia trades at $181.42 right now.", source: PRICE }
  ],
  assumptions: ["You'll hold for months, not days.", "You're fine with daily swings of 5% or more."],
  opinions: ["Memory makers could gain if AI spending keeps growing. It may not."]
}

export const SUGGESTIONS = [
  "Create an agent that only rebalances my portfolio",
  "What's Nvidia's price?",
  "Sell Tesla if it drops 10%",
  "How did I do this week?"
]
