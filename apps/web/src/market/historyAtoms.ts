import type { HistoryRange, StockSymbol } from "@bluechip/domain/market/Market"
import * as Atom from "effect/reactivity/Atom"
import { historyAtom } from "../atoms/market.ts"

export const HISTORY_RANGES: ReadonlyArray<{ readonly id: HistoryRange; readonly description: string }> = [
  { id: "1D", description: "Past day" },
  { id: "1W", description: "Past week" },
  { id: "1M", description: "Past month" },
  { id: "3M", description: "Past 3 months" },
  { id: "ALL", description: "All time" }
]

// `historyAtom` builds a new atom per call, so each stock's five are made once and reused across renders.
const rangeAtoms = Atom.family((symbol: StockSymbol) => HISTORY_RANGES.map(({ id }) => historyAtom(symbol, id)))

/** A stock's history for every range at once, so switching the chart's tabs needs no further request. */
export const historiesAtom = Atom.family((symbol: StockSymbol) =>
  Atom.make((get) => rangeAtoms(symbol).map((atom) => get(atom)))
)
