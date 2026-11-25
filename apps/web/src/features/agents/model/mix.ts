// A target mix between the domain (weights in basis points, cash as `USDC`) and `@bluechip/ui`'s allocation editor
// (whole percents per stock, cash as what's left).
import { StockSymbol } from "@bluechip/domain/market/Market"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import type { AllocationTarget } from "@bluechip/ui/bluechip/allocation-editor"
import * as Schema from "effect/Schema"

const isStockSymbol = Schema.is(StockSymbol)

/** The mix in whole percents, one row per stock it trades (cash is what's left). */
export const editorTargets = (
  stocks: ReadonlyArray<StockSymbol>,
  targets: ReadonlyArray<Target>
): Array<AllocationTarget> =>
  stocks.map((symbol) => ({
    symbol,
    target: Math.round((targets.find((target) => target.asset === symbol)?.weight ?? 0) / 100)
  }))

/** The editor's rows back as targets, with cash taking the rest. */
export const fromEditor = (rows: ReadonlyArray<AllocationTarget>): ReadonlyArray<Target> => {
  const weights = rows
    .filter((row) => isStockSymbol(row.symbol))
    .map((row) => ({ asset: row.symbol as StockSymbol, weight: row.target * 100 }))
  const cash = 10_000 - weights.reduce((sum, target) => sum + target.weight, 0)
  return [...weights, { asset: "USDC", weight: cash }]
}
