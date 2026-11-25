import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { stocksAtom } from "../atoms/market.ts"

/**
 * Each stock by its symbol, with live prices, and its name (the symbol until the list loads); `names` holds the names
 * of those loaded.
 */
export function useStockLookup() {
  const stocks = useAtomValue(stocksAtom)

  return useMemo(() => {
    const bySymbol = new Map<StockSymbol, Stock>(
      AsyncResult.isSuccess(stocks) ? stocks.value.map((stock) => [stock.symbol, stock]) : []
    )
    const names: ReadonlyMap<StockSymbol, string> = new Map(
      Array.from(bySymbol, ([symbol, stock]) => [symbol, stock.name])
    )
    return {
      names,
      stockOf: (symbol: StockSymbol) => bySymbol.get(symbol),
      nameOf: (symbol: StockSymbol) => bySymbol.get(symbol)?.name ?? symbol
    }
  }, [stocks])
}
