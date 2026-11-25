import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { stocksAtom } from "../../../atoms/market.ts"
import { MarketPill } from "../../../market/MarketPill.tsx"
import { AppPage } from "../../../shell/AppPage.tsx"
import { StockListRow } from "./-components/StockListRow.tsx"

export const Route = createFileRoute("/_app/stocks/")({ component: Stocks })

const PLACEHOLDER_ROWS = ["a", "b", "c", "d", "e", "f"]

function Stocks() {
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(stocksAtom)
  return (
    <AppPage title="Stocks" actions={<MarketPill className="hidden sm:inline-flex" />}>
      <MarketPill className="justify-self-start sm:hidden" />
      <p className="text-body-sm text-g-600">
        Tokenized US stocks on Base. Each token tracks the price of its stock.
      </p>
      <section className="overflow-hidden rounded-lg bg-white shadow-e2" aria-busy={AsyncResult.isInitial(stocks)}>
        {AsyncResult.isSuccess(stocks) ?
          stocks.value.map((stock) => <StockListRow key={stock.symbol} stock={stock} />) :
          AsyncResult.isInitial(stocks) ?
          PLACEHOLDER_ROWS.map((id) => (
            <div key={id} className="flex items-center gap-3.5 border-b border-g-100 px-4 py-4 last:border-b-0">
              <SkeletonBlock className="h-7 w-16" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-4 w-20" />
            </div>
          )) :
          (
            <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
              <MarketPill className="justify-self-start sm:hidden" />
              <p className="text-body-sm text-g-600">
                We couldn't load the stocks. Check your connection and try again.
              </p>
              <Button variant="secondary" onClick={refresh}>Try again</Button>
            </div>
          )}
      </section>
    </AppPage>
  )
}
