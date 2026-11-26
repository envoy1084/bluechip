import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import { AllocationEditor } from "@bluechip/ui/bluechip/allocation-editor"
import { editorTargets, fromEditor } from "../../../model/mix.ts"

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
  // The editor already marks a stock over the cap, cash under the reserve and a mix that doesn't add up, on the rows.
  const cap = targets.some((target) => target.asset !== "USDC" && target.weight > capBps)
  const cash = (targets.find((target) => target.asset === "USDC")?.weight ?? 0) < reserveBps
  const sum = targets.reduce((total, target) => total + target.weight, 0) !== 10_000
  const shownOnRows = stocks.length > 0 && (cap || cash || sum)

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
      {problem === undefined || shownOnRows ?
        null :
        <p className="text-label-sm font-medium text-loss">{problem}</p>}
    </div>
  )
}
