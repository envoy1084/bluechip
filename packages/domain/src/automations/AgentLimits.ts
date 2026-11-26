/**
 * What an automation reads of the agent it runs for: the stocks it trades, which way, and its largest trade, daily
 * budget and trades per day. Only to catch at setup what its policies could never pass; the chain decides each trade.
 *
 * @since 0.0.0
 */
import type { StockSymbol } from "../market/Market.ts"
import type { AgentSpec } from "../policies/AgentSpec.ts"
import { configOf } from "../policies/Policy.ts"
import { trade } from "../policies/Trade.ts"
import { tradeSize } from "../policies/TradeSize.ts"
import { tradesPerDay } from "../policies/TradesPerDay.ts"
import type { CheckContext, FieldProblem } from "./Entry.ts"

/**
 * The limits an automation is planned within; `null` fields when the spec doesn't carry the policy.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface AgentLimits {
  readonly stocks: ReadonlyArray<StockSymbol>
  readonly direction: "buy" | "sell" | "both" | "rebalance"
  readonly dailyBudget: bigint
  readonly maxPerTrade: bigint | null
  readonly minPerTrade: bigint | null
  readonly tradesPerDay: number | null
}

/**
 * The agent's limits, `null` for your own trades.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const limitsOf = (spec: AgentSpec | null): AgentLimits | null => {
  if (spec === null) return null
  const trading = configOf(spec.policies, trade)
  const size = configOf(spec.policies, tradeSize)
  return {
    stocks: trading?.stocks ?? [],
    direction: trading?.direction ?? "both",
    dailyBudget: trading?.dailyBudget ?? BigInt(0),
    maxPerTrade: size?.maxPerTrade ?? null,
    minPerTrade: size?.minPerTrade ?? null,
    tradesPerDay: configOf(spec.policies, tradesPerDay)?.count ?? null
  }
}

/**
 * Why `symbols` can't be used by the agent: a stock it doesn't trade. Nothing for your own trades.
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const stockProblems = (
  field: string,
  symbols: ReadonlyArray<StockSymbol>,
  context: CheckContext
): ReadonlyArray<FieldProblem> => {
  const limits = limitsOf(context.spec)
  if (limits === null) return []
  const foreign = symbols.filter((symbol) => !limits.stocks.includes(symbol))
  return foreign.length === 0 ? [] : [{ field, message: `This agent doesn't trade ${foreign.join(", ")}.` }]
}

/**
 * Why the agent can't trade `side` at all: a buy for an agent that only sells, a sale for one that only buys, either
 * for one that only trades back to its target mix.
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const directionProblems = (side: "buy" | "sell", context: CheckContext): ReadonlyArray<FieldProblem> => {
  const limits = limitsOf(context.spec)
  if (limits === null || limits.direction === "both" || limits.direction === side) return []
  if (limits.direction === "rebalance") {
    return [{ field: null, message: "This agent only trades back to its target mix: use rebalance." }]
  }
  return [{ field: null, message: side === "buy" ? "This agent only sells." : "This agent only buys." }]
}
