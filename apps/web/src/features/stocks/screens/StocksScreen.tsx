import type { Stock } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { StockListRow } from "../components/StockListRow.tsx"

const PLACEHOLDER_ROWS = ["a", "b", "c", "d", "e", "f"]

const matches = (stock: Stock, query: string) => {
  const needle = query.trim().toLowerCase()
  return needle === "" || stock.name.toLowerCase().includes(needle) || stock.symbol.toLowerCase().includes(needle)
}

function StockRows({ query }: Readonly<{ query: string }>) {
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
    return (
      <div className="grid justify-items-center gap-3 px-6 py-10 text-center">
        <p className="text-body-sm text-g-600">We couldn't load the stocks. Check your connection and try again.</p>
        <Button variant="secondary" onClick={refresh}>Try again</Button>
      </div>
    )
  }
  const shown = stocks.value.filter((stock) => matches(stock, query))
  if (shown.length === 0) {
    return <p className="px-4 py-10 text-center text-body-sm text-g-500">No stock matches “{query.trim()}”.</p>
  }
  return shown.map((stock) => <StockListRow key={stock.symbol} stock={stock} />)
}

/** Every stock bluechip trades, searchable, with its past day and price. */
export function StocksScreen() {
  const stocks = useAtomValue(stocksAtom)
  const [query, setQuery] = useState("")
  const count = AsyncResult.isSuccess(stocks) ? stocks.value.length : undefined
  return (
    <AppPage title="Stocks" actions={<MarketPill className="hidden sm:inline-flex" />} width="wide">
      <div className="mx-auto grid w-full max-w-[820px] gap-3.5">
        <InputGroup className="sm:max-w-[300px]">
          <Icon name="search" size={16} />
          <InputGroupInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={count === undefined ? "Search stocks" : `Search ${count} stocks`}
            aria-label="Search stocks"
            autoComplete="off"
          />
        </InputGroup>
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
            <StockRows query={query} />
          </div>
        </section>
        <p className="text-center text-label-sm text-g-600">
          These are Coinbase's tokenized US stocks on Base. Each one tracks its stock's price.
        </p>
      </div>
    </AppPage>
  )
}
