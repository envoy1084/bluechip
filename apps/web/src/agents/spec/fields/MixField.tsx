import { StockSymbol } from "@bluechip/domain/market/Market"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import { AllocationEditor, type AllocationTarget } from "@bluechip/ui/bluechip/allocation-editor"
import * as Schema from "effect/Schema"

const isStockSymbol = Schema.is(StockSymbol)

/** The mix in whole percents, as the allocation editor takes it (cash is what's left). */
const editorTargets = (stocks: ReadonlyArray<StockSymbol>, targets: ReadonlyArray<Target>) =>
  stocks.map((symbol) => ({
    symbol,
    target: Math.round((targets.find((target) => target.asset === symbol)?.weight ?? 0) / 100)
  }))

/** The editor's rows back as targets, with cash taking the rest. */
const fromEditor = (rows: ReadonlyArray<AllocationTarget>): ReadonlyArray<Target> => {
  const weights = rows
    .filter((row) => isStockSymbol(row.symbol))
    .map((row) => ({ asset: row.symbol as StockSymbol, weight: row.target * 100 }))
  const cash = 10_000 - weights.reduce((sum, target) => sum + target.weight, 0)
  return [...weights, { asset: "USDC", weight: cash }]
}

/**
 * A target mix over the stocks it trades, with cash for the rest. `mixKey` changes when what the mix depends on
 * changes (the stocks, the cap, the reserve), so the editor starts again from the mix as it is then.
 */
export function MixField(
  { label, stocks, targets, capBps, reserveBps, mixKey, problem, onChange }: Readonly<{
    label: string
    stocks: ReadonlyArray<StockSymbol>
    targets: ReadonlyArray<Target>
    capBps: number
    reserveBps: number
    mixKey: string
    problem?: string | undefined
    onChange: (targets: ReadonlyArray<Target>) => void
  }>
) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[13.5px] font-medium text-g-700">{label}</span>
      {stocks.length === 0 ?
        <p className="text-label-sm text-g-500">Pick the stocks it trades to set their targets.</p> :
        (
          <AllocationEditor
            key={mixKey}
            defaultValue={editorTargets(stocks, targets)}
            cap={capBps / 100}
            reserve={reserveBps / 100}
            onValueChange={(rows) => onChange(fromEditor(rows))}
            className="max-w-none px-0 py-0 shadow-none"
          />
        )}
      {problem === undefined ? null : <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
