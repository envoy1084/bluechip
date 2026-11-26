// Your holding of a stock as its page shows it, with the agents that may trade it.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Stock } from "@bluechip/domain/market/Market"
import { configOf } from "@bluechip/domain/policies/Policy"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { trade } from "@bluechip/domain/policies/Trade"
import type { Holding } from "@bluechip/domain/portfolio/Portfolio"
import type { HoldingDetailProps } from "@bluechip/ui/bluechip/holding-detail"
import { bpsPercent, priceDollars, shareCount } from "../../../lib/amounts.ts"

/**
 * The facts of a holding at the stock's live price: shares, price, today's move and its share of your money, the
 * running agents that trade it, and the most one may put in it when one agent alone does. `null` without a price.
 */
export const holdingFacts = (
  holding: Holding,
  stock: Stock,
  agents: ReadonlyArray<Agent>
): Omit<HoldingDetailProps, "actions" | "className"> | null => {
  const price = stock.price?.price ?? holding.price?.price
  if (price === undefined || holding.shares === BigInt(0)) return null

  const trading = agents.filter((agent) =>
    agent.status === "active" && (configOf(agent.spec.policies, trade)?.stocks.includes(stock.symbol) ?? false)
  )
  const cap = trading.length === 1 ? configOf(trading[0]!.spec.policies, stockCap)?.maxBps : undefined

  return {
    symbol: stock.symbol,
    name: stock.name,
    shares: shareCount(holding.shares),
    price: priceDollars(price),
    dayChangePercent: bpsPercent(stock.change24h ?? holding.change24h ?? 0),
    weight: bpsPercent(holding.weightBps),
    ...(cap === undefined ? {} : { cap: bpsPercent(cap) }),
    agents: trading.map((agent) => ({ id: agent.id, name: agent.name }))
  }
}
