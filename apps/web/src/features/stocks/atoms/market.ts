import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { stocksAtom } from "../../../atoms/market.ts"

/** One stock from {@link stocksAtom}. */
export const stockAtom = Atom.family((symbol: StockSymbol) =>
  Atom.make((get) => AsyncResult.map(get(stocksAtom), (stocks) => stocks.find((stock) => stock.symbol === symbol)))
)
