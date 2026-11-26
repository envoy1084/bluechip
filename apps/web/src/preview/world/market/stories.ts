// The intents that didn't simply fill: trades blocked by each policy, left waiting for each reason, declined,
// expired, cancelled or failed, and the approvals the cast's asking agents wait on. Someone who just started has one
// buy waiting for gas, the typical account a few, the heavy user one of every kind.
import type { AgentId } from "@bluechip/domain/Ids"
import type { Decision, IntentSource, IntentStatus, WaitReason } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { previewId } from "../ids.ts"
import { automationOfAgent } from "./history.ts"
import type { MarketWorld } from "./model.ts"
import { priceAt } from "./prices.ts"
import { nextNumber, pricedTrade, utc } from "./records.ts"
import { addApproval } from "./signing.ts"
import { addIntent, legOf } from "./trading.ts"

const HOUR = 3_600_000
const DAY = 24 * HOUR

interface Story {
  /** The cast agent's number, or `null` for your own trade. */
  readonly agent: number | null
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly dollars: number
  readonly status: IntentStatus
  readonly decision: ((at: number) => Decision) | null
  readonly daysAgo: number
  readonly heavyOnly: boolean
  readonly source?: IntentSource
  readonly reason?: string
}

const refused = (policy: PolicyId, error: string | null, message: string, stock: StockSymbol | null = null) => () =>
  ({ _tag: "Refused", policy, error, stock, message }) as const

const waited = (reason: WaitReason, forMinutes: number) => (at: number): Decision => ({
  _tag: "Wait",
  reason,
  until: utc(at + forMinutes * 60_000)
})

const STORIES: ReadonlyArray<Story> = [
  {
    agent: 1,
    symbol: "NVDA",
    side: "buy",
    dollars: 800,
    status: "blocked",
    decision: refused("stockCap", "OverStockCap", "Would put too much of your money in NVIDIA.", "NVDA"),
    daysAgo: 3,
    heavyOnly: false,
    source: "assistant",
    reason: "NVIDIA looks cheap after the sell-off."
  },
  {
    agent: 1,
    symbol: "AAPL",
    side: "buy",
    dollars: 300,
    status: "waiting",
    decision: waited("gasPrice", 50),
    daysAgo: 0.1,
    heavyOnly: false,
    source: "assistant"
  },
  {
    agent: 2,
    symbol: "AAPL",
    side: "buy",
    dollars: 25,
    status: "blocked",
    decision: refused("tradesPerDay", null, "It has made all of today's trades."),
    daysAgo: 0.05,
    heavyOnly: false,
    source: "automation",
    reason: "Your weekly buy."
  },
  {
    agent: null,
    symbol: "MSFT",
    side: "buy",
    dollars: 150,
    status: "failed",
    decision: null,
    daysAgo: 6,
    heavyOnly: false
  },
  {
    agent: 1,
    symbol: "MSFT",
    side: "buy",
    dollars: 1_500,
    status: "declined",
    decision: () => ({ _tag: "OverLargestTrade", maxPerTrade: Usdc.make(BigInt(1_000_000_000)) }),
    daysAgo: 9,
    heavyOnly: false,
    source: "assistant",
    reason: "Microsoft's cloud numbers beat expectations."
  },
  {
    agent: 1,
    symbol: "NVDA",
    side: "sell",
    dollars: 400,
    status: "expired",
    decision: waited("pricesStale", 30),
    daysAgo: 15,
    heavyOnly: true
  },
  {
    agent: 2,
    symbol: "AAPL",
    side: "buy",
    dollars: 25,
    status: "expired",
    decision: waited("gasSpent", 600),
    daysAgo: 6,
    heavyOnly: true
  },
  {
    agent: 4,
    symbol: "TSLA",
    side: "sell",
    dollars: 520,
    status: "expired",
    decision: waited("noGas", 240),
    daysAgo: 45,
    heavyOnly: true
  },
  {
    agent: 5,
    symbol: "META",
    side: "buy",
    dollars: 640,
    status: "cancelled",
    decision: waited("dayEnding", 2),
    daysAgo: 20,
    heavyOnly: true
  },
  {
    agent: 7,
    symbol: "MSFT",
    side: "buy",
    dollars: 100,
    status: "expired",
    decision: waited("unavailable", 5),
    daysAgo: 100,
    heavyOnly: true
  },
  {
    agent: 9,
    symbol: "NVDA",
    side: "buy",
    dollars: 350,
    status: "expired",
    decision: waited("pricesPaused", 2_000),
    daysAgo: 150,
    heavyOnly: true
  },
  {
    agent: 1,
    symbol: "NVDA",
    side: "buy",
    dollars: 250,
    status: "failed",
    decision: () => ({ _tag: "Passes", callGasLimit: BigInt(398_000) }),
    daysAgo: 11,
    heavyOnly: true
  },
  {
    agent: 3,
    symbol: "AMZN",
    side: "buy",
    dollars: 2_200,
    status: "blocked",
    decision: refused("rebalance", "Overshoots", "Would push Amazon past its target.", "AMZN"),
    daysAgo: 10,
    heavyOnly: true,
    source: "automation"
  },
  {
    agent: 4,
    symbol: "TSLA",
    side: "sell",
    dollars: 600,
    status: "blocked",
    decision: refused("stopLossFloor", "AboveFloor", "Would sell Tesla above the floor you set.", "TSLA"),
    daysAgo: 25,
    heavyOnly: true,
    source: "automation",
    reason: "Tesla fell 6% this morning."
  },
  {
    agent: 5,
    symbol: "META",
    side: "buy",
    dollars: 900,
    status: "blocked",
    decision: refused("rebalance", "NoProgress", "Wouldn't bring your mix closer to its target."),
    daysAgo: 8,
    heavyOnly: true,
    source: "automation"
  },
  {
    agent: 7,
    symbol: "MSFT",
    side: "buy",
    dollars: 400,
    status: "blocked",
    decision: refused("cashReserve", "UnderCashReserve", "Would leave too little in cash."),
    daysAgo: 110,
    heavyOnly: true,
    source: "automation"
  },
  {
    agent: 9,
    symbol: "NVDA",
    side: "buy",
    dollars: 500,
    status: "blocked",
    decision: refused("fairPrice", "UnfairPrice", "Too far from Chainlink's price.", "NVDA"),
    daysAgo: 170,
    heavyOnly: true
  },
  {
    agent: 9,
    symbol: "NVDA",
    side: "sell",
    dollars: 700,
    status: "blocked",
    decision: refused(
      "slippageBudget",
      "OverSlippageBudget",
      "Would lose more to prices than this week's budget allows."
    ),
    daysAgo: 140,
    heavyOnly: true
  },
  {
    agent: 1,
    symbol: "AAPL",
    side: "buy",
    dollars: 2,
    status: "blocked",
    decision: refused("tradeSize", "TooSmall", "Smaller than the smallest trade it makes."),
    daysAgo: 18,
    heavyOnly: true,
    source: "assistant"
  },
  {
    agent: 2,
    symbol: "AAPL",
    side: "buy",
    dollars: 25,
    status: "blocked",
    decision: refused("gasBudget", null, "Would spend more on gas than today's budget allows."),
    daysAgo: 4,
    heavyOnly: true,
    source: "automation"
  },
  {
    agent: 3,
    symbol: "MSFT",
    side: "buy",
    dollars: 760,
    status: "expired",
    decision: () => ({ _tag: "Ask" }),
    daysAgo: 12,
    heavyOnly: true,
    source: "automation"
  }
]

// A starter's agent tried a second small Nvidia buy a few minutes ago, while gas was high.
const STARTER_STORIES: ReadonlyArray<Story> = [
  {
    agent: 1,
    symbol: "NVDA",
    side: "buy",
    dollars: 15,
    status: "waiting",
    decision: waited("gasPrice", 40),
    daysAgo: 0.01,
    heavyOnly: false,
    source: "assistant",
    reason: "NVIDIA dipped this morning."
  }
]

/** Adds the cast's stories and its asking agents' approvals to the world. */
export const addStories = (world: MarketWorld, now: number) => {
  const { cast, market } = world
  if (cast.scenario === "newPerson") return

  for (const story of cast.scenario === "starter" ? STARTER_STORIES : STORIES) {
    if (story.heavyOnly && cast.scenario !== "heavy") continue
    const agent = story.agent === null
      ? null
      : cast.agents.find((candidate) => candidate.id === previewId("agent", story.agent!))
    if (agent === undefined || (agent !== null && agent.ageDays <= story.daysAgo)) continue

    const at = now - story.daysAgo * DAY
    const agentId: AgentId | null = agent?.id ?? null
    const leg = legOf(market, story.symbol, story.side, story.dollars)
    const tradeId = story.status === "failed" ? failedTrade(world, story, agentId, at) : null
    const automationId = agent === null || story.source !== "automation" ? null : automationOfAgent(cast, agent)
    const open = story.status === "waiting"

    addIntent(market, {
      agentId,
      source: story.source ?? (agent === null ? "owner" : "assistant"),
      leg,
      ...(story.reason === undefined ? {} : { reason: story.reason }),
      status: story.status,
      decision: story.decision?.(at) ?? null,
      tradeId,
      expiresAt: open ? now + 6 * HOUR : story.status === "expired" ? at + 24 * HOUR : null,
      at,
      updatedAt: story.status === "expired" ? at + 24 * HOUR : at + 4 * 60_000
    }, automationId)
  }

  for (const agent of cast.agents.filter((candidate) => candidate.state === "asking")) {
    addApproval(world, agent, cast.scenario === "heavy" ? 3 : 2, now - 2 * HOUR)
  }
}

const failedTrade = (world: MarketWorld, story: Story, agentId: AgentId | null, at: number) => {
  const { market } = world
  const n = nextNumber(market)
  const trade = pricedTrade({
    n,
    symbol: story.symbol,
    side: story.side,
    amount: legOf(market, story.symbol, story.side, story.dollars).amount,
    reference: priceAt(market.book, market.prices.get(story.symbol)!, at),
    referenceStatus: "live",
    gapBps: 7,
    agentId,
    status: "failed",
    at,
    settledAt: at + 22_000
  })
  market.trades.push({ trade, automationId: null })
  return trade.id
}
