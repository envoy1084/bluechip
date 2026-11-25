import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import type { MarketState } from "./market-status.tsx"
import { Price } from "./price-change.tsx"
import { Sparkline } from "./sparkline.tsx"
import { TickerChip } from "./ticker-chip.tsx"

export interface StockRowProps extends Omit<ComponentProps<"button">, "children"> {
  readonly symbol: string
  readonly name: string
  readonly price: number
  /** Change since the last close, in percent. */
  readonly change: number
  /** Today's prices, oldest first. */
  readonly history: ReadonlyArray<number>
  readonly market: MarketState
  /** The index in `history` where the market closed: the rest is drawn dashed. */
  readonly closedFrom?: number
  /** Marks the row as the chosen one (aria-pressed). Leave it out for a plain button. */
  readonly selected?: boolean
}

const NOTE: Readonly<Record<MarketState, { readonly label: string; readonly className: string }>> = {
  open: { label: "Open", className: "text-g-500" },
  extended: { label: "Extended hours", className: "text-g-500" },
  paused: { label: "Price paused", className: "text-warn" },
  closed: { label: "Last close", className: "text-g-500" },
  weekend: { label: "Last close", className: "text-g-500" },
  halted: { label: "Halted", className: "text-warn" }
}

/**
 * A stock you can buy: price, today's change, the day's shape and whether its market is open. The sparkline hides
 * on narrow screens; when the market is closed its tail is dashed.
 */
export function StockRow(
  { symbol, name, price, change, history, market, closedFrom, selected, className, ...props }: StockRowProps
) {
  const note = NOTE[market]
  return (
    <button
      type="button"
      data-slot="stock-row"
      aria-pressed={selected}
      className={cn(
        "grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-g-100 bg-white px-4 py-[11px] text-left last:border-b-0 sm:grid-cols-[60px_minmax(0,1fr)_88px_112px]",
        "cursor-pointer transition-colors duration-fast ease-brand hover:bg-[#fafbfc]",
        "focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none",
        "aria-pressed:bg-blue-50 aria-pressed:shadow-[inset_3px_0_0_var(--color-blue)]",
        className
      )}
      {...props}
    >
      <TickerChip symbol={symbol} />
      <span className="grid min-w-0 gap-px">
        <b className="text-body-sm font-[550]">{name}</b>
        <span className={cn("inline-flex items-center gap-[5px] text-caption", note.className)}>
          {market === "open" ?
            <i aria-hidden className="size-1.5 rounded-full bg-green shadow-[0_0_0_2.5px_rgba(102,200,0,.2)]" /> :
            <Icon name={market === "halted" || market === "paused" ? "pause" : "moon"} size={12} />}
          {note.label}
        </span>
      </span>
      <Sparkline
        values={history}
        width={88}
        height={28}
        className="hidden sm:block"
        {...(market === "open" || closedFrom === undefined ? {} : { closedFrom })}
      />
      <span className="flex justify-end">
        <Price price={price} change={change} size="sm" layout="stacked" />
      </span>
    </button>
  )
}
