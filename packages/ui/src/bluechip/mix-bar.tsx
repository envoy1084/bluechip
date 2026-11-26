import type { ComponentProps } from "react"
import { cn } from "../lib/cn.ts"
import { tickerColors } from "../lib/tickers.ts"

/** One part of a mix: a stock by its symbol, `cash`, or `others` (the rest folded together), with its share. */
export interface MixPart {
  readonly id: string
  readonly label: string
  /** Its share of the whole, 0 to 100. */
  readonly percent: number
}

/** A part's color: the stock's own, as on its ticker chip, cash in grey, the rest folded together in dark grey. */
export const mixColor = (id: string): string =>
  id === "cash" ? "var(--color-series-cash)" : id === "others" ? "var(--color-series-8)" : tickerColors(id).bottom

const rounded = (percent: number) => `${Math.round(percent)}%`

/** What a mix says to screen readers: each part and its share, "Apple 42%, Cash 58%". */
export const mixText = (parts: ReadonlyArray<MixPart>): string =>
  parts.filter((part) => part.percent > 0).map((part) => `${part.label} ${rounded(part.percent)}`).join(", ")

export interface MixBarProps extends Omit<ComponentProps<"div">, "children"> {
  readonly parts: ReadonlyArray<MixPart>
  /** Said before the shares, for screen readers: "Now", "After". */
  readonly label?: string
}

/** How money is split, as one strip of the stocks' own colors with cash in grey. Parts at 0% are left out. */
export function MixBar({ parts, label, className, ...props }: MixBarProps) {
  const shown = parts.filter((part) => part.percent > 0)
  return (
    <div
      data-slot="mix-bar"
      // The strip is drawn from spans, so it takes the img role and says its shares as its name.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={label === undefined ? mixText(shown) : `${label}: ${mixText(shown)}`}
      className={cn("flex h-2 gap-0.5 overflow-hidden rounded-full bg-g-100", className)}
      {...props}
    >
      {shown.map((part) => (
        <span
          key={part.id}
          className="h-full min-w-1 transition-[width] duration-slow ease-brand first:rounded-l-full last:rounded-r-full"
          style={{ width: `${part.percent}%`, background: mixColor(part.id) }}
        />
      ))}
    </div>
  )
}

/** One part's share before and after, for `MixCompare`. */
export interface MixChange {
  readonly id: string
  readonly label: string
  readonly before: number
  readonly after: number
}

export interface MixCompareProps extends Omit<ComponentProps<"div">, "children"> {
  readonly changes: ReadonlyArray<MixChange>
  readonly beforeLabel?: string
  readonly afterLabel?: string
}

/** A mix now and after a plan, as two strips, then each part's share going from one to the other. */
export function MixCompare(
  { changes, beforeLabel = "Now", afterLabel = "After", className, ...props }: MixCompareProps
) {
  const parts = (field: "before" | "after") =>
    changes.map((change) => ({ id: change.id, label: change.label, percent: change[field] }))

  return (
    <div data-slot="mix-compare" className={cn("grid gap-2.5", className)} {...props}>
      <div className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 text-caption text-g-500">
        <span>{beforeLabel}</span>
        <MixBar parts={parts("before")} label={beforeLabel} />
        <span>{afterLabel}</span>
        <MixBar parts={parts("after")} label={afterLabel} />
      </div>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {changes.map((change) => (
          <li key={change.id} className="flex items-center gap-2 text-label-sm">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: mixColor(change.id) }} />
            <span className="min-w-0 flex-1 truncate text-g-700">{change.label}</span>
            <span className="text-g-500 tabular-nums">{rounded(change.before)}</span>
            <span aria-hidden className="text-g-400">→</span>
            <span className="sr-only">to</span>
            <span className="w-9 text-right font-semibold tabular-nums">{rounded(change.after)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
