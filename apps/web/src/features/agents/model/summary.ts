// An agent at a glance, for its summary: what it does in a line, its last trade, today's use against its limits.
import type { AgentUsage } from "@bluechip/domain/agents/Agent"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { formatDate, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { toDollars } from "./fieldText.ts"

/** What it does, in one line: "Buys and sells Nvidia and Apple", "Rebalances Apple, Nvidia and cash". */
export const doesText = (spec: AgentSpec, nameOf: (symbol: StockSymbol) => string): string => {
  const config = configOf(spec.policies, trade)
  if (config === undefined) return "Trades nothing yet"
  const names = config.stocks.map(nameOf)
  switch (config.direction) {
    case "both":
      return `Buys and sells ${listNames(names)}`
    case "buy":
      return `Buys ${listNames(names)}`
    case "sell":
      return `Sells ${listNames(names)}`
    case "rebalance":
      return `Rebalances ${listNames([...names, "cash"])}`
  }
}

/** Its last trade, as a sentence: "Bought $50.00 of Apple at 09:41" today, else "on Mon 23 Nov", in `zone`. */
export const lastTradeText = (
  intent: Pick<Intent, "leg" | "updatedAt">,
  nameOf: (symbol: StockSymbol) => string,
  now: Date,
  zone: string
): string => {
  const done = describeLeg(intent.leg, nameOf).replace(/^Buy /, "Bought ").replace(/^Sell /, "Sold ")
  const at = DateTime.toDateUtc(intent.updatedAt)
  const sameDay = formatDate(at, { timeZone: zone, time: false }) === formatDate(now, { timeZone: zone, time: false })
  return sameDay ?
    `${done} at ${formatTime(at, { timeZone: zone })}` :
    `${done} on ${formatDate(at, { timeZone: zone, time: false })}`
}

/** Today's use against its limits, in dollars and trades; a sell-only agent's budget is 0. */
export const todayOf = (usage: AgentUsage) => {
  const spent = usage.policies.find((counted) => counted.policy === "trade")
  const trades = usage.policies.find((counted) => counted.policy === "tradesPerDay")
  return {
    spentToday: toDollars(spent?.used ?? BigInt(0)),
    dailyBudget: toDollars(spent?.limit ?? BigInt(0)),
    tradesToday: Number(trades?.used ?? BigInt(0)),
    tradesPerDay: Number(trades?.limit ?? BigInt(0))
  }
}
