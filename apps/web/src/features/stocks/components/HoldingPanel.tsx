import type { Stock } from "@bluechip/domain/market/Market"
import { HoldingDetail } from "@bluechip/ui/bluechip/holding-detail"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { usdcDollars } from "../../../lib/amounts.ts"
import { stockPerformanceAtom } from "../atoms/performance.ts"
import { holdingFacts } from "../model/holding.ts"

/**
 * Your holding of the stock, when you have one: what it's worth at the live price, today's move, what it returned on
 * what you paid (from the ledger), its share of your money and the agents that trade it. Nothing when you hold none.
 */
export function HoldingPanel({ stock }: Readonly<{ stock: Stock }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const agents = useAtomValue(agentsAtom)
  const performance = useAtomValue(stockPerformanceAtom(stock.symbol))
  if (!AsyncResult.isSuccess(portfolio)) return null

  const holding = portfolio.value.holdings.find((each) => each.symbol === stock.symbol)
  if (holding === undefined) return null
  const facts = holdingFacts(holding, stock, AsyncResult.isSuccess(agents) ? agents.value : [])
  if (facts === null) return null

  return (
    <HoldingDetail
      {...facts}
      {...(AsyncResult.isSuccess(performance) && performance.value.cost > BigInt(0) ?
        { cost: usdcDollars(performance.value.cost) } :
        {})}
      className="w-full max-w-none"
    />
  )
}
