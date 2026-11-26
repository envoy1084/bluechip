import {
  PortfolioSummary,
  PortfolioSummaryError,
  PortfolioSummarySkeleton
} from "@bluechip/ui/bluechip/portfolio-summary"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { cashDialogAtom } from "../atoms/cashDialog.ts"
import { portfolioAtom } from "../atoms/portfolio.ts"
import { useStockLookup } from "../hooks/useStockLookup.ts"
import { moneySummary } from "../lib/moneySummary.ts"

/**
 * Your money at a glance, at live prices: what it's worth, today's move, and what it's in, with Add cash unless the
 * page has its own (`addCash: false`).
 */
export function MoneySummary({ addCash = true }: Readonly<{ addCash?: boolean }>) {
  const portfolio = useAtomValue(portfolioAtom)
  const refresh = useAtomRefresh(portfolioAtom)
  const openCash = useAtomSet(cashDialogAtom)
  const { nameOf } = useStockLookup()

  if (AsyncResult.isInitial(portfolio)) return <PortfolioSummarySkeleton />
  if (!AsyncResult.isSuccess(portfolio)) return <PortfolioSummaryError onRetry={refresh} />

  return (
    <PortfolioSummary
      {...moneySummary(portfolio.value, nameOf)}
      addCash={addCash ?
        (
          <Button variant="secondary" size="sm" onClick={() => openCash("add")}>
            <Icon name="plus" size={14} />Add cash
          </Button>
        ) :
        undefined}
    />
  )
}
