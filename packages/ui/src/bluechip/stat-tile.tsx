import type { ComponentProps, ReactNode } from "react"
import { cn } from "../lib/cn.ts"

export interface StatTileProps extends Omit<ComponentProps<"div">, "children"> {
  /** What it measures: "Value", "Today", "Share of your money". */
  readonly label: string
  /** The number, large: often a `NumberRoll` or a `PriceChange`. */
  readonly value: ReactNode
  /** One muted line under it. */
  readonly detail?: ReactNode
}

/** One number with its label, for grids of facts: a holding's value, an agent's spend, a portfolio's cash. */
export function StatTile({ label, value, detail, className, ...props }: StatTileProps) {
  return (
    <div data-slot="stat-tile" className={cn("grid content-start gap-1", className)} {...props}>
      <dt className="text-label-sm text-g-500">{label}</dt>
      <dd className="grid gap-0.5">
        <span className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-ink tabular-nums">
          {value}
        </span>
        {detail === undefined ? null : <span className="text-label-sm text-g-500">{detail}</span>}
      </dd>
    </div>
  )
}

/** A grid of stat tiles: two across on phones, up to four on wider cards. */
export function StatGrid({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      data-slot="stat-grid"
      className={cn("grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]", className)}
      {...props}
    />
  )
}
