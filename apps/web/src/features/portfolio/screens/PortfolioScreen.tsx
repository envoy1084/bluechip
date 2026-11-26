import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { cashDialogAtom } from "../../../atoms/cashDialog.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { performanceAtom } from "../atoms/performance.ts"
import { CashCard } from "../components/CashCard.tsx"
import { ContributionsCard } from "../components/ContributionsCard.tsx"
import { HistoryChart } from "../components/HistoryChart.tsx"
import { HoldingsCard } from "../components/HoldingsCard.tsx"
import { MixCard } from "../components/MixCard.tsx"
import { SummaryCard } from "../components/SummaryCard.tsx"

export function PortfolioScreen() {
  const portfolio = useAtomValue(portfolioAtom)
  const refresh = useAtomRefresh(portfolioAtom)
  const openCash = useAtomSet(cashDialogAtom)
  const performance = useAtomValue(performanceAtom)

  const { names } = useStockLookup()
  const cash = AsyncResult.isSuccess(portfolio) ? portfolio.value.cash : BigInt(0)

  return (
    <AppPage
      title="Portfolio"
      width="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            className="hidden sm:inline-flex"
            disabled={cash === BigInt(0)}
            onClick={() => openCash("withdraw")}
          >
            <Icon name="upload" size={14} />Withdraw
          </Button>
          <Button size="sm" onClick={() => openCash("add")}>
            <Icon name="plus" size={14} />Add cash
          </Button>
        </>
      }
    >
      {AsyncResult.isInitial(portfolio) && (
        <div aria-busy className="grid gap-4">
          <SkeletonBlock className="h-64 w-full" />
          <SkeletonBlock className="h-48 w-full" />
        </div>
      )}

      {AsyncResult.isFailure(portfolio) && <LoadProblem what="your portfolio" onRetry={refresh} safe variant="card" />}

      {AsyncResult.isSuccess(portfolio) && portfolio.value.value === BigInt(0) && (
        <IllustratedEmpty
          illustration="seedling"
          title="No stocks yet"
          action={
            <>
              <Button onClick={() => openCash("add")}>
                <Icon name="plus" size={16} />Add cash
              </Button>
              <ButtonLink variant="ghost" render={<Link to="/stocks" />}>See stocks</ButtonLink>
            </>
          }
        >
          Add cash, then buy a stock you like. Your chart starts with your first deposit.
        </IllustratedEmpty>
      )}

      {AsyncResult.isSuccess(portfolio) && portfolio.value.value > BigInt(0) && (
        <div className="grid gap-4">
          <SummaryCard portfolio={portfolio.value} performance={performance} />
          <HistoryChart performance={performance} />
          <div className="grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 content-start gap-4">
              <HoldingsCard portfolio={portfolio.value} names={names} />
              {AsyncResult.isSuccess(performance) && (
                <ContributionsCard performance={performance.value} names={names} />
              )}
            </div>
            <div className="grid min-w-0 content-start gap-4">
              <MixCard portfolio={portfolio.value} names={names} />
              <CashCard cash={portfolio.value.cash} />
            </div>
          </div>
        </div>
      )}
    </AppPage>
  )
}
