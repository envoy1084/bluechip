// What each limit is called on screen and how its value reads, for the limits form and a change's review.
import type { Limits } from "@bluechip/domain/agents/Limits"
import type { LimitField } from "@bluechip/domain/agents/Rules"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"

/** Each limit's name, as the form labels it. */
export const LIMIT_LABELS: Readonly<Record<LimitField, string>> = {
  stocks: "Stocks it can trade",
  mode: "How it trades",
  dailyBudget: "Daily spend",
  maxPerTrade: "Max per trade",
  askAbove: "Ask me above",
  maxInOneStock: "Max in one stock",
  cashReserve: "Cash reserve",
  targets: "Target mix",
  tradesPerDay: "Trades a day",
  priceProtection: "Fair price check",
  weeklySlippage: "Weekly price loss",
  rebalanceTrigger: "Rebalance when off by",
  tradeWhilePaused: "Weekends and holidays"
}

const MODES: Readonly<Record<Limits["mode"], string>> = {
  rebalance: "Rebalance only",
  buy: "Buy only",
  sell: "Sell only",
  both: "Buy and sell"
}

const dollars = (amount: bigint) => formatDollars(Number(amount) / 1_000_000)

/** Basis points as a percent: 50 → "0.5%". */
export const bpsLabel = (bps: number) => `${bps / 100}%`

/** Names joined as people say them: "Nvidia, Apple and Tesla". */
export const listNames = (names: ReadonlyArray<string>): string => {
  if (names.length === 0) return "None"
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/** One limit's value as the review shows it: "$250", "30%", "Nvidia and Apple". */
export const formatLimitField = (
  field: LimitField,
  limits: Limits,
  nameOf: (symbol: StockSymbol) => string
): string => {
  switch (field) {
    case "stocks":
      return listNames(limits.stocks.map(nameOf))
    case "mode":
      return MODES[limits.mode]
    case "dailyBudget":
    case "maxPerTrade":
    case "askAbove":
      return dollars(limits[field])
    case "maxInOneStock":
    case "cashReserve":
    case "priceProtection":
    case "weeklySlippage":
    case "rebalanceTrigger":
      return bpsLabel(limits[field])
    case "tradesPerDay":
      return String(limits.tradesPerDay)
    case "tradeWhilePaused":
      return limits.tradeWhilePaused ? "Trades" : "Waits for live prices"
    case "targets":
      return limits.targets
        .map((target) => `${target.asset === "USDC" ? "Cash" : nameOf(target.asset)} ${bpsLabel(target.weight)}`)
        .join(", ")
  }
}
