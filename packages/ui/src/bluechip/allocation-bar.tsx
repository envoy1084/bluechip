import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps, CSSProperties } from "react"
import { cn } from "../lib/cn.ts"

/** Where a weight sits against its max: under it, at it (within 1 point), or over it. */
export type CapState = "under" | "at" | "over"

/** Over once it passes the max by more than rounding; at within 1 point below it. */
export const capState = (weight: number, cap: number): CapState =>
  weight > cap + 0.05 ? "over" : weight >= cap - 1 ? "at" : "under"

const pct = (value: number) => `${value.toFixed(1)}%`
const clamp = (value: number) => Math.max(0, Math.min(100, value))

export const allocationBarVariants = cva(
  "relative block w-full rounded-full bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.04)]",
  {
    variants: {
      size: {
        sm: "h-1.5",
        md: "h-2",
        lg: "h-3 [&_[data-slot=allocation-bar-cap]]:-inset-y-1.5 [&_[data-slot=allocation-bar-cap]]:w-[3px]"
      }
    },
    defaultVariants: { size: "sm" }
  }
)

const FILL: Readonly<Record<CapState | "cash", string>> = {
  under: "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
  at: "bg-[linear-gradient(180deg,#ffd84d,#f5b800)] shadow-[inset_0_1px_0_rgba(255,255,255,.45)]",
  // Blue up to the max, red past it: the overflow is the part that matters.
  over:
    "bg-[linear-gradient(90deg,#4c76ff_0,#2a5bff_var(--split),var(--color-loss)_var(--split),#ef5a3a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
  cash: "bg-[linear-gradient(180deg,#d3d7de,#b1b7c3)]"
}

export interface AllocationBarProps
  extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof allocationBarVariants>
{
  /** Share of your money in this holding, 0 to 100. */
  readonly weight: number
  /** Your max in one stock (or, for cash, your minimum), 0 to 100. Drawn as a black tick. */
  readonly cap: number
  /** What a trade would make the weight: a hatched red segment from `weight` to here. */
  readonly projected?: number
  /** Cash: grey fill, and `cap` is the reserve you keep. */
  readonly cash?: boolean
  /** What the bar measures, for screen readers: "Nvidia". Defaults to "Share of your money". */
  readonly label?: string
}

/**
 * How much of your money is in one holding, on a 0–100% scale, against your max (the black tick). Under is blue,
 * at the max amber, over it red past the tick. Prices can push a stock over; nothing is sold for you.
 */
export function AllocationBar(
  { weight, cap, projected, cash = false, label, size, className, style, ...props }: AllocationBarProps
) {
  const state = capState(projected ?? weight, cap)
  const text = cash ?
    `${pct(weight)} in cash, keep at least ${cap}%` :
    projected !== undefined ?
    `${pct(weight)} of your money now, would be ${pct(projected)}, your max is ${cap}%` :
    state === "over" ?
    `${pct(weight)} of your money, ${pct(weight - cap)} over your ${cap}% max` :
    state === "at" ?
    `${pct(weight)} of your money, at your ${cap}% max` :
    `${pct(weight)} of your money, max ${cap}%`
  const fill = clamp(weight)
  return (
    <span
      data-slot="allocation-bar"
      data-state={cash ? "cash" : state}
      // The bar draws a cap tick and a projected segment, which a native <meter> can't hold.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="meter"
      aria-label={label ?? "Share of your money"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Number(weight.toFixed(1))}
      aria-valuetext={text}
      className={cn(allocationBarVariants({ size }), className)}
      style={{ ...style, "--split": `${(cap / Math.max(fill, 0.01)) * 100}%` } as CSSProperties}
      {...props}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 rounded-[inherit] transition-[width,background] duration-slow ease-brand",
          FILL[cash ? "cash" : projected === undefined ? state : "under"]
        )}
        style={{ width: `${Math.max(0.5, fill)}%` }}
      />
      {projected !== undefined && projected > weight && (
        <span
          data-slot="allocation-bar-projected"
          className="absolute inset-y-0 rounded-r-full bg-[repeating-linear-gradient(135deg,rgba(217,58,28,.55)_0_3px,rgba(217,58,28,.18)_3px_6px)]"
          style={{ left: `${fill}%`, width: `${clamp(projected) - fill}%` }}
        />
      )}
      <span
        data-slot="allocation-bar-cap"
        aria-hidden
        className={cn(
          "absolute -inset-y-1 -ml-px w-0.5 rounded-[1px] shadow-[0_0_0_1.5px_#fff]",
          cash ? "bg-g-500" : "bg-ink"
        )}
        style={{ left: `${clamp(cap)}%` }}
      />
    </span>
  )
}
