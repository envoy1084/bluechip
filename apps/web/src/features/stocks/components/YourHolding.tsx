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
 * Your holding of this stock, once you have one: its value, today's move, what you paid (from the ledger), its share
 * of your money, its agents.
 */
export function YourHolding({ stock }: Readonly<{ stock: Stock }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const agents = useAtomValue(agentsAtom)
  const performance = useAtomValue(stockPerformanceAtom(stock.symbol))
  if (!AsyncResult.isSuccess(portfolio)) return null

  const holding = portfolio.value.holdings.find((each) => each.symbol === stock.symbol)
  const facts = holding === undefined ?
    null :
    holdingFacts(holding, stock, AsyncResult.isSuccess(agents) ? agents.value : [])
  if (facts === null) return null

  const cost = AsyncResult.isSuccess(performance) && performance.value.lots.length > 0 ?
    usdcDollars(performance.value.cost) :
    undefined
  return <HoldingDetail {...facts} {...(cost === undefined ? {} : { cost })} />
}
