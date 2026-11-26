// An agent's limits at a glance, for its cards in chat: the stocks it may trade, which way, and its three numbers.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface AgentGlance {
  readonly stocks: ReadonlyArray<StockSymbol>
  /** `null` without a trade policy. */
  readonly direction: string | null
  readonly stats: ReadonlyArray<{ readonly label: string; readonly value: string }>
}

const DIRECTION: Readonly<Record<string, string>> = {
  buy: "Only buys",
  sell: "Only sells",
  both: "Buys and sells",
  rebalance: "Trades back to your mix"
}

// Budgets are whole dollars: "$250", not "$250.00".
const dollars = (units: bigint) => formatMoney(usdcDollars(units)).replace(/\.00$/u, "")

/** `spec`'s stocks, direction, and its daily budget, largest trade and trades a day ("Any" when nothing caps one). */
export const agentGlance = (spec: AgentSpec): AgentGlance => {
  const trading = configOf(spec.policies, trade)
  const size = configOf(spec.policies, tradeSize)
  const perDay = configOf(spec.policies, tradesPerDay)

  return {
    stocks: trading?.stocks ?? [],
    direction: trading === undefined ? null : DIRECTION[trading.direction] ?? null,
    stats: [
      {
        label: "A day",
        value: trading === undefined || trading.dailyBudget === BigInt(0) ? "None" : dollars(trading.dailyBudget)
      },
      { label: "Per trade", value: size === undefined ? "Any" : dollars(size.maxPerTrade) },
      { label: "Trades a day", value: perDay === undefined ? "Any" : String(perDay.count) }
    ]
  }
}
