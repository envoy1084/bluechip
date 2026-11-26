import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { companyLogos } from "@bluechip/ui/logos/company"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { stockAtom } from "../atoms/market.ts"
import { PriceHistoryChart } from "../components/PriceHistoryChart.tsx"
import { PricesPausedBanner } from "../components/PricesPausedBanner.tsx"
import { QuoteBox } from "../components/QuoteBox.tsx"
import { StockHeader } from "../components/StockHeader.tsx"
import { StockNotFound } from "../components/StockNotFound.tsx"
import { YourHolding } from "../components/YourHolding.tsx"
import { YourResults } from "../components/YourResults.tsx"

/** A stock's page: its price, your holding of it, its history, and the box to buy or sell it. */
export function StockScreen({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  const stock = useAtomValue(stockAtom(symbol))
  const refresh = useAtomRefresh(stockAtom(symbol))
  if (AsyncResult.isSuccess(stock)) {
    return stock.value === undefined ? <StockNotFound /> : <StockContent stock={stock.value} />
  }
  return (
    <AppPage title={symbol} actions={<MarketPill className="hidden sm:inline-flex" />} width="wide">
      {AsyncResult.isInitial(stock) ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-16 w-64" />
            <SkeletonBlock className="h-64 w-full" />
          </div>
        ) :
        (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-body-sm text-g-600">We couldn't load this stock. Check your connection and try again.</p>
            <Button variant="secondary" onClick={refresh}>Try again</Button>
          </div>
        )}
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
      actions={<MarketPill className="hidden sm:inline-flex" />}
      width="wide"
    >
      <div className="grid gap-4">
        <PricesPausedBanner />
        <StockHeader stock={stock} />
        <YourHolding stock={stock} />
        <YourResults symbol={stock.symbol} />
        <div className="grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <PriceHistoryChart symbol={stock.symbol} />
          <QuoteBox stock={stock} />
        </div>
      </div>
    </AppPage>
  )
}
