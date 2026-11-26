import type { Stock } from "@bluechip/domain/market/Market"
import { HoldingDetail } from "@bluechip/ui/bluechip/holding-detail"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { holdingFacts } from "../model/holding.ts"

/** Your holding of this stock, once you have one: its value, today's move, its share of your money, its agents. */
export function YourHolding({ stock }: Readonly<{ stock: Stock }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const agents = useAtomValue(agentsAtom)
  if (!AsyncResult.isSuccess(portfolio)) return null

  const holding = portfolio.value.holdings.find((each) => each.symbol === stock.symbol)
  const facts = holding === undefined ?
    null :
    holdingFacts(holding, stock, AsyncResult.isSuccess(agents) ? agents.value : [])
  return facts === null ? null : <HoldingDetail {...facts} />
}
