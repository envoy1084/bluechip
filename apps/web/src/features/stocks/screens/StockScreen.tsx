import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { companyLogos } from "@bluechip/ui/logos/company"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect } from "react"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { previousPage, track } from "../../../lib/analytics.ts"
import { stockViewSource } from "../../../lib/pagePath.ts"
import { stockAtom } from "../atoms/market.ts"
import { HoldingPanel } from "../components/HoldingPanel.tsx"
import { PriceHistoryChart } from "../components/PriceHistoryChart.tsx"
import { PricesPausedBanner } from "../components/PricesPausedBanner.tsx"
import { QuoteBox } from "../components/QuoteBox.tsx"
import { StockHeader } from "../components/StockHeader.tsx"
import { StockNotFound } from "../components/StockNotFound.tsx"

/** A stock's page: its price, your holding of it, its history, and the box to buy or sell it. */
export function StockScreen({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  useEffect(() => track({ _tag: "stock_viewed", symbol, from: stockViewSource(previousPage()) }), [symbol])
  const stock = useAtomValue(stockAtom(symbol))
  const refresh = useAtomRefresh(stockAtom(symbol))
  if (AsyncResult.isSuccess(stock)) {
    return stock.value === undefined ? <StockNotFound /> : <StockContent stock={stock.value} />
  }
  return (
    <AppPage title={symbol} width="wide">
      {AsyncResult.isInitial(stock) ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-16 w-64" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) :
        <LoadProblem what="this stock" onRetry={refresh} variant="card" />}
    </AppPage>
  )
}

function StockContent({ stock }: Readonly<{ stock: Stock }>) {
  const CompanyLogo = companyLogos[stock.symbol]

  return (
    <AppPage
      title={stock.name}
      icon={CompanyLogo === undefined ?
        undefined :
        (
          <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-white shadow-e1 [&_svg]:h-auto [&_svg]:max-h-5 [&_svg]:max-w-6">
            <CompanyLogo />
          </span>
        )}
      sub={
        <>
          <Link to="/stocks" className="hover:text-ink">Stocks</Link> / {stock.name}
        </>
      }
      width="wide"
    >
      <div className="grid gap-4">
        <PricesPausedBanner />
        <StockHeader stock={stock} />
        <div className="grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-4">
            <PriceHistoryChart stock={stock} />
            <HoldingPanel stock={stock} />
          </div>
          <QuoteBox stock={stock} />
        </div>
      </div>
    </AppPage>
  )
}
