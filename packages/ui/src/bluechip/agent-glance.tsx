import type { ComponentProps, ReactNode } from "react"
import { cn } from "../lib/cn.ts"
import { TickerChip } from "./ticker-chip.tsx"

export interface AgentGlanceProps extends Omit<ComponentProps<"div">, "children"> {
  /** The stocks it may trade, by symbol. */
  readonly stocks: ReadonlyArray<string>
  /** Which way it trades: "Buys and sells". */
  readonly direction?: string
  /** Its numbers: "A day $250", "Per trade $100", "Trades a day 5". */
  readonly stats: ReadonlyArray<{ readonly label: string; readonly value: ReactNode }>
}

/**
 * An agent's limits at a glance, compact for a card: the stocks it may trade as chips, which way it trades, then its
 * numbers side by side.
 */
export function AgentGlance({ stocks, direction, stats, className, ...props }: AgentGlanceProps) {
  return (
    <div
      data-slot="agent-glance"
      className={cn("grid gap-2.5 rounded-[12px] px-3 py-2.5 surface-well", className)}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {stocks.length === 0 ?
          <span className="text-label-sm text-g-500">No stocks yet</span> :
          (
            <ul aria-label="Its stocks" className="flex flex-wrap gap-1">
              {stocks.map((symbol) => (
                <li key={symbol}>
                  <TickerChip symbol={symbol} size="sm" />
                </li>
              ))}
            </ul>
          )}
        {direction === undefined ? null : <span className="text-label-sm font-medium text-g-600">{direction}</span>}
      </div>
      {stats.length === 0 ? null : (
        <dl className="grid grid-cols-3 gap-3 border-t border-ink/6 pt-2">
          {stats.map((stat) => (
            <div key={stat.label} className="grid min-w-0 gap-0.5">
              <dt className="truncate text-caption text-g-500">{stat.label}</dt>
              <dd className="text-[13.5px] font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
