import type { ReactNode } from "react"
import { Button } from "../components/button.tsx"
import { SkeletonBlock } from "../components/skeleton.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { PriceChange } from "./price-change.tsx"

export interface PortfolioPosition {
  readonly symbol: string
  readonly name: string
  /** Its value now, in dollars. */
  readonly value: number
}

/** One segment of the allocation strip: a holding, the ones folded into "Others", or cash. */
export interface AllocationSegment {
  readonly id: string
  readonly label: string
  readonly value: number
  /** Its share of the whole, in percent. */
  readonly percent: number
  /** A CSS color: the series in order, grey for cash. */
  readonly color: string
}

const SERIES = Array.from({ length: 6 }, (_, index) => `var(--color-series-${index + 1})`)

/**
 * The allocation strip's segments: the largest holdings first, up to `shown` of them, the rest folded into "Others",
 * then cash. Empty money (no holdings, no cash) has no segments.
 */
export const allocationSegments = (
  positions: ReadonlyArray<PortfolioPosition>,
  cash: number,
  shown = 4
): ReadonlyArray<AllocationSegment> => {
  const total = positions.reduce((sum, position) => sum + position.value, 0) + cash
  if (total <= 0) return []

  const sorted = positions.filter((position) => position.value > 0).toSorted((a, b) => b.value - a.value)
  const top = sorted.slice(0, shown)
  const rest = sorted.slice(shown).reduce((sum, position) => sum + position.value, 0)
  const percent = (value: number) => (value / total) * 100

  return [
    ...top.map((position, index) => ({
      id: position.symbol,
      label: position.name,
      value: position.value,
      percent: percent(position.value),
      color: SERIES[index] ?? "var(--color-series-8)"
    })),
    ...(rest > 0 ?
      [{ id: "others", label: "Others", value: rest, percent: percent(rest), color: "var(--color-series-8)" }] :
      []),
    ...(cash > 0 ?
      [{ id: "cash", label: "Cash", value: cash, percent: percent(cash), color: "var(--color-series-cash)" }] :
      [])
  ]
}

export interface PortfolioSummaryProps {
  /** Everything you have, in dollars: holdings plus cash. */
  readonly value: number
  /** How much it moved today, in dollars. */
  readonly dayChange: number
  /** The same, in percent. */
  readonly dayChangePercent: number
  readonly cash: number
  readonly positions: ReadonlyArray<PortfolioPosition>
  /** The way to add cash, shown when there's nothing yet and under the cash line. */
  readonly addCash?: ReactNode
  readonly className?: string
}

/**
 * Your money at a glance: what it's worth, how it moved today, and what it's in, as one strip with a legend.
 * Empty money says how to start instead.
 */
export function PortfolioSummary(
  { value, dayChange, dayChangePercent, cash, positions, addCash, className }: PortfolioSummaryProps
) {
  const segments = allocationSegments(positions, cash)

  return (
    <section
      data-slot="portfolio-summary"
      aria-label="Your money"
      className={cn("grid gap-4 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <div className="grid gap-1">
        <span className="text-label text-g-500">Your money</span>
        <NumberRoll
          value={value}
          format={formatMoney}
          className="text-[34px] leading-none font-semibold tracking-[-0.04em]"
        />
        {segments.length === 0 ? null : (
          <span className="flex flex-wrap items-center gap-1.5 text-label text-g-500">
            <PriceChange value={dayChangePercent} amount={dayChange} />
            today
          </span>
        )}
      </div>

      {segments.length === 0 ?
        (
          <div className="grid justify-items-start gap-2.5 rounded-[12px] px-4 py-3.5 surface-well">
            <p className="text-body-sm text-g-700">
              Nothing here yet. Add USDC on Base to buy your first stock or start an agent.
            </p>
            {addCash}
          </div>
        ) :
        (
          <>
            <div
              // The strip is drawn from spans, so it takes the img role and says its shares as its name.
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
              role="img"
              aria-label={segments.map((segment) => `${segment.label} ${Math.round(segment.percent)}%`).join(", ")}
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            >
              {segments.map((segment) => (
                <span
                  key={segment.id}
                  className="h-full min-w-1 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${segment.percent}%`, background: segment.color }}
                />
              ))}
            </div>
            <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {segments.map((segment) => (
                <li key={segment.id} className="flex items-center gap-2 text-label">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: segment.color }} />
                  <span className="min-w-0 flex-1 truncate text-g-700">{segment.label}</span>
                  <span className="text-g-500 tabular-nums">{Math.round(segment.percent)}%</span>
                  <span className="w-[84px] text-right font-semibold tabular-nums">{formatMoney(segment.value)}</span>
                </li>
              ))}
            </ul>
            {addCash === undefined ?
              null :
              (
                <div className="flex items-center justify-between gap-2 border-t border-g-100 pt-3 text-label text-g-500">
                  <span>{formatMoney(cash)} in cash to invest</span>
                  {addCash}
                </div>
              )}
          </>
        )}
    </section>
  )
}

/** The summary while it loads: the same shape, so nothing jumps when it arrives. */
export function PortfolioSummarySkeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-busy
      aria-label="Loading your money"
      className={cn("grid gap-4 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <div className="grid gap-2">
        <SkeletonBlock className="h-3.5 w-20" />
        <SkeletonBlock className="h-8 w-44" />
        <SkeletonBlock className="h-3.5 w-28" />
      </div>
      <SkeletonBlock className="h-2.5 w-full rounded-full" />
      <div className="grid gap-2 sm:grid-cols-2">
        {["a", "b", "c", "d"].map((id) => <SkeletonBlock key={id} className="h-4 w-full" />)}
      </div>
    </div>
  )
}

/** When the money couldn't be read: one line and the way to try again. Nothing about it changed. */
export function PortfolioSummaryError(
  { onRetry, className }: { readonly onRetry: () => void; readonly className?: string }
) {
  return (
    <section
      aria-label="Your money"
      className={cn("grid justify-items-start gap-2.5 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <p className="flex items-center gap-1.5 text-body-sm text-g-700">
        <Icon name="error" size={16} className="text-loss" />
        We couldn't load your money. Check your connection and try again.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
    </section>
  )
}
