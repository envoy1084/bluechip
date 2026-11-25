import { Limits, RebalanceTrigger, Target } from "@bluechip/domain/agents/Limits"
import type { LimitChange } from "@bluechip/domain/agents/Rules"
import { StockSymbol } from "@bluechip/domain/market/Market"
import { AllocationEditor, type AllocationTarget } from "@bluechip/ui/bluechip/allocation-editor"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import * as Schema from "effect/Schema"
import { bpsLabel } from "./limitFields.ts"
import { ChangeMark, LimitSection } from "./LimitsFormFields.tsx"

const isStockSymbol = Schema.is(StockSymbol)

/**
 * A starting mix for `stocks`: an even share each, never past the max in one stock, and cash for the rest, so it
 * always passes the target checks.
 */
export const evenTargets = (stocks: ReadonlyArray<StockSymbol>, limits: Limits): ReadonlyArray<Target> => {
  if (stocks.length === 0) return []

  const room = 100 - Math.ceil(limits.cashReserve / 100)
  const each = Math.min(Math.floor(room / stocks.length), Math.floor(limits.maxInOneStock / 100))
  const cash = 100 - each * stocks.length

  return [
    ...stocks.map((asset) => new Target({ asset, weight: each * 100 })),
    new Target({ asset: "USDC", weight: cash * 100 })
  ]
}

/** The mix in whole percents, as the allocation editor takes it (cash is what's left). */
const editorTargets = (limits: Limits): ReadonlyArray<AllocationTarget> =>
  limits.stocks.map((symbol) => ({
    symbol,
    target: Math.round((limits.targets.find((target) => target.asset === symbol)?.weight ?? 0) / 100)
  }))

/** The editor's mix back as limits: its stocks are the ones the agent trades, and cash takes the rest. */
const fromEditor = (limits: Limits, rows: ReadonlyArray<AllocationTarget>): Limits => {
  const stocks = rows.map((row) => row.symbol).filter(isStockSymbol)
  const weights = stocks.map((asset) =>
    new Target({ asset, weight: rows.find((row) => row.symbol === asset)!.target * 100 })
  )
  const cash = 10_000 - weights.reduce((sum, target) => sum + target.weight, 0)

  return new Limits({ ...limits, stocks, targets: [...weights, new Target({ asset: "USDC", weight: cash })] })
}

const TRIGGERS = RebalanceTrigger.literals

/**
 * A Rebalancer's target mix and how far off it may drift before it trades. `mixKey` changes when the stocks are
 * picked elsewhere, so the editor starts again from the new mix.
 */
export function TargetMixSection(
  { limits, mixKey, change, triggerChange, problem, onChange }: Readonly<{
    limits: Limits
    mixKey: number
    change: LimitChange | undefined
    triggerChange: LimitChange | undefined
    problem: string | undefined
    onChange: (limits: Limits) => void
  }>
) {
  return (
    <LimitSection title="Target mix" change={change} problem={problem}>
      {limits.stocks.length === 0 ?
        <p className="text-label-sm text-g-500">Pick the stocks it trades to set their targets.</p> :
        (
          <AllocationEditor
            key={mixKey}
            defaultValue={editorTargets(limits)}
            cap={limits.maxInOneStock / 100}
            reserve={limits.cashReserve / 100}
            onValueChange={(rows) => onChange(fromEditor(limits, rows))}
            className="max-w-none px-0 py-0 shadow-none"
          />
        )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="flex flex-wrap items-center gap-2 text-label-sm text-g-600">
          Trade when the mix is off by
          <ChangeMark change={triggerChange} />
        </span>
        <ToggleGroup
          size="sm"
          aria-label="Trade when the mix is off by"
          value={[String(limits.rebalanceTrigger)]}
          onValueChange={(values) => {
            const picked = TRIGGERS.find((trigger) => String(trigger) === values[0])
            if (picked !== undefined) onChange(new Limits({ ...limits, rebalanceTrigger: picked }))
          }}
        >
          {TRIGGERS.map((trigger) => (
            <ToggleGroupItem key={trigger} value={String(trigger)}>{bpsLabel(trigger)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </LimitSection>
  )
}
