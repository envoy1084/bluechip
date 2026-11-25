import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Alert, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { stocksAtom } from "../../../atoms/market.ts"
import { portfolioAtom } from "../../../atoms/portfolio.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { cashDialogAtom } from "../../../funding/cashDialog.ts"
import { CashCard } from "./-components/CashCard.tsx"
import { HoldingsCard } from "./-components/HoldingsCard.tsx"
import { MixCard } from "./-components/MixCard.tsx"
import { ValueChart } from "./-components/ValueChart.tsx"
import { WithdrawalsCard } from "./-components/WithdrawalsCard.tsx"

export const Route = createFileRoute("/_app/portfolio/")({ component: PortfolioPage })

function PortfolioPage() {
  const portfolio = useAtomValue(portfolioAtom)
  const refresh = useAtomRefresh(portfolioAtom)
  const stocks = useAtomValue(stocksAtom)
  const openCash = useAtomSet(cashDialogAtom)

  const names = useMemo(
    () =>
      new Map<StockSymbol, string>(
        AsyncResult.isSuccess(stocks) ? stocks.value.map((stock) => [stock.symbol, stock.name]) : []
      ),
    [stocks]
  )
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

      {AsyncResult.isFailure(portfolio) && (
        <Alert variant="destructive">
          <AlertTitle>We couldn't load your portfolio</AlertTitle>
          <AlertDescription>
            Your money is safe; this is only the page. Check your connection and try again.
          </AlertDescription>
          <Button variant="secondary" size="sm" onClick={refresh}>
            <Icon name="refresh" size={14} />Try again
          </Button>
        </Alert>
      )}

      {AsyncResult.isSuccess(portfolio) && portfolio.value.value === BigInt(0) && (
        <Empty className="py-14">
          <EmptyMedia>
            <Illustration name="seedling" size={64} />
          </EmptyMedia>
          <EmptyTitle>No stocks yet</EmptyTitle>
          <EmptyDescription>
            Add cash, then buy a stock you like. Your chart starts with your first deposit.
          </EmptyDescription>
          <EmptyContent className="flex-row">
            <Button onClick={() => openCash("add")}>
              <Icon name="plus" size={16} />Add cash
            </Button>
            <Button variant="ghost" nativeButton={false} render={<Link to="/stocks" />}>See stocks</Button>
          </EmptyContent>
        </Empty>
      )}

      {AsyncResult.isSuccess(portfolio) && portfolio.value.value > BigInt(0) && (
        <div className="grid gap-4">
          <ValueChart />
          <div className="grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <HoldingsCard portfolio={portfolio.value} names={names} />
            <div className="grid min-w-0 content-start gap-4">
              <MixCard portfolio={portfolio.value} names={names} />
              <CashCard cash={portfolio.value.cash} />
              <WithdrawalsCard />
              <Alert variant="info">
                <AlertTitle>Dividends and splits</AlertTitle>
                <AlertDescription>
                  When a stock pays a dividend or splits, each token stands for a different number of shares, so its
                  value changes with it. Prices here already account for that.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  )
}
