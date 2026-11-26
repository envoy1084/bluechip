import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { StockListRow } from "../components/StockListRow.tsx"

const PLACEHOLDER_ROWS = ["a", "b", "c", "d", "e", "f"]

function StockRows() {
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(stocksAtom)
  if (AsyncResult.isInitial(stocks)) {
    return PLACEHOLDER_ROWS.map((id) => (
      <div key={id} className="flex items-center gap-3.5 border-b border-g-100 px-4 py-[15px] last:border-b-0">
        <SkeletonBlock className="h-[30px] w-14 rounded-[7px]" />
        <SkeletonBlock className="h-4 flex-1" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
    ))
  }
  if (!AsyncResult.isSuccess(stocks)) {
    return <LoadProblem what="the stocks" onRetry={refresh} />
  }
  return stocks.value.map((stock) => <StockListRow key={stock.symbol} stock={stock} />)
}

/** Every stock bluechip trades (13, so no search), with its past day and price. */
export function StocksScreen() {
  const stocks = useAtomValue(stocksAtom)
  return (
    <AppPage title="Stocks" actions={<MarketPill className="hidden sm:inline-flex" />} width="wide">
      <div className="mx-auto grid w-full max-w-[820px] gap-3.5">
        <section
          aria-labelledby="stocks-title"
          aria-busy={AsyncResult.isInitial(stocks)}
          className="overflow-hidden rounded-lg bg-white shadow-e2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
            <h2 id="stocks-title" className="text-body-sm font-semibold tracking-normal">Stocks on bluechip</h2>
            <span className="text-label-sm text-g-500">Past day and price</span>
          </div>
          <div className="grid">
            <StockRows />
          </div>
        </section>
        <p className="text-center text-label-sm text-g-600">
          These are Coinbase's tokenized US stocks on Base. Each one tracks its stock's price.
        </p>
      </div>
    </AppPage>
  )
}
