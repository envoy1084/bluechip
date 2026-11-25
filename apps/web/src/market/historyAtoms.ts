import type { HistoryRange, StockSymbol } from "@bluechip/domain/market/Market"
import * as Atom from "effect/reactivity/Atom"
import { historyAtom } from "../atoms/market.ts"

export const HISTORY_RANGES: ReadonlyArray<
  { readonly id: HistoryRange; readonly label: string; readonly description: string }
> = [
  { id: "1D", label: "1D", description: "Past day" },
  { id: "1W", label: "1W", description: "Past week" },
  { id: "1M", label: "1M", description: "Past month" },
  { id: "ALL", label: "All", description: "All time" }
]

// `historyAtom` builds a new atom per call, so each stock's ranges are made once and reused across renders: the list's
// sparklines and the stock page's chart then share one request per range.
const rangeAtoms = Atom.family((symbol: StockSymbol) => HISTORY_RANGES.map(({ id }) => historyAtom(symbol, id)))

/** A stock's past day, for its sparkline. */
export const dayHistoryAtom = (symbol: StockSymbol) => rangeAtoms(symbol)[0]!

/** A stock's history for every range at once, so switching the chart's tabs needs no further request. */
export const historiesAtom = Atom.family((symbol: StockSymbol) =>
  Atom.make((get) => rangeAtoms(symbol).map((atom) => get(atom)))
)
