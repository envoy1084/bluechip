import { type Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Schema from "effect/Schema"
import { stockAtom } from "../../../atoms/market.ts"
import { MarketPill } from "../../../market/MarketPill.tsx"
import { AppPage } from "../../../shell/AppPage.tsx"
import { PriceHistoryChart } from "./-components/PriceHistoryChart.tsx"
import { QuoteBox } from "./-components/QuoteBox.tsx"
import { StockHeader } from "./-components/StockHeader.tsx"

export const Route = createFileRoute("/_app/stocks/$symbol")({ component: StockPage })

const isStockSymbol = Schema.is(StockSymbol)

function NotFound() {
  return (
    <AppPage title="Stock not found" actions={<MarketPill className="hidden sm:inline-flex" />}>
      <Empty>
        <EmptyTitle>We don't have that stock</EmptyTitle>
        <EmptyDescription>Check the symbol, or pick one from the list.</EmptyDescription>
        <Button variant="secondary" nativeButton={false} render={<Link to="/stocks" />}>See all stocks</Button>
      </Empty>
    </AppPage>
  )
}

function StockPage() {
  const { symbol } = Route.useParams()
  return isStockSymbol(symbol) ? <KnownStock symbol={symbol} /> : <NotFound />
}

function KnownStock({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  const stock = useAtomValue(stockAtom(symbol))
  const refresh = useAtomRefresh(stockAtom(symbol))
  if (AsyncResult.isSuccess(stock)) {
    return stock.value === undefined ? <NotFound /> : <StockContent stock={stock.value} />
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
  return (
    <AppPage
      title={stock.name}
      sub={<Link to="/stocks" className="hover:text-ink">Stocks</Link>}
      actions={<MarketPill className="hidden sm:inline-flex" />}
      width="wide"
    >
      <MarketPill className="justify-self-start sm:hidden" />
      <StockHeader stock={stock} />
      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <PriceHistoryChart symbol={stock.symbol} />
        <QuoteBox stock={stock} />
      </div>
    </AppPage>
  )
}
