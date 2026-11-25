import type { Limits } from "@bluechip/domain/agents/Limits"
import { CASH_SYMBOL, TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { bpsLabel } from "../../../../../agents/limitFields.ts"

const segment = (index: number) => `var(--color-series-${(index % 8) + 1})`

/** A Rebalancer's target mix as one bar, with each stock's and cash's share beside its chip. */
export function TargetMixBar({ limits }: Readonly<{ limits: Limits }>) {
  const stocks = limits.targets.filter((target) => target.asset !== "USDC")
  const cash = limits.targets.find((target) => target.asset === "USDC")?.weight ?? 0

  return (
    <div className="grid gap-2">
      <span className="text-label-sm font-semibold text-g-500">Target mix</span>
      <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-g-100">
        {stocks.map((target, index) => (
          <i
            key={target.asset}
            className="block min-w-0"
            style={{ flexGrow: target.weight, background: segment(index) }}
          />
        ))}
        <i className="block min-w-0" style={{ flexGrow: cash, background: "var(--color-series-cash)" }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {[...stocks, { asset: CASH_SYMBOL, weight: cash }].map((target) => (
          <span key={target.asset} className="inline-flex items-center gap-1.5 text-[13.5px]">
            <TickerChip symbol={target.asset} size="sm" />
            <b className="font-semibold tabular-nums">{bpsLabel(target.weight)}</b>
          </span>
        ))}
      </div>
    </div>
  )
}
