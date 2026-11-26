import { defineChart } from "@tanstack/charts"
import { pie, polar, radialArc } from "@tanstack/charts/polar"
import { Chart } from "@tanstack/charts/react"
import { type ComponentProps, useMemo } from "react"
import { cn } from "../lib/cn.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"
import { usageLevel } from "./usage-meter.tsx"

export interface UsageDialProps extends Omit<ComponentProps<"figure">, "children"> {
  /** What it counts: "Daily budget", "Trades today". */
  readonly label: string
  readonly used: number
  /** The limit; `null` counts with no cap and leaves the inner ring empty. */
  readonly limit: number | null
  /** How much of the day its limit counts over has gone, 0 to 1. */
  readonly dayGone: number
  /** How a number reads; defaults to a plain count. */
  readonly format?: (value: number) => string
}

const SIZE = 196
const DAY = { inner: 90, outer: 95 }
const USED = { inner: 68, outer: 84 }
const TAU = Math.PI * 2

// Written out in full: Tailwind only emits the theme variables it finds in the source.
const TONE = { normal: "var(--color-blue)", near: "#f5b400", full: "var(--color-loss)" } as const
const TRACK = "var(--color-g-100)"
const CLOCK = "var(--color-g-400)"

const arc = (id: string, share: number, radii: { readonly inner: number; readonly outer: number }, fill: string) =>
  radialArc(pie([{ id, value: 1 }], { value: "value", endAngle: Math.max(0.0001, share) * TAU }), {
    id,
    key: "id",
    innerRadius: radii.inner,
    outerRadius: radii.outer,
    cornerRadius: (radii.outer - radii.inner) / 2,
    fill
  })

const count = (value: number) => value.toLocaleString("en-US")

const percent = (share: number) => `${Math.round(share * 100)}%`

/**
 * A daily limit against the clock: the thick inner ring fills as the limit is used (blue while there's room, amber
 * from 80%, red when it's used up), the thin outer ring as the day goes, so a glance says whether it is spending ahead
 * of the day. What's left rolls in the middle. The rings sweep to each new value, and stay put under reduced motion.
 */
export function UsageDial(
  { label, used, limit, dayGone, format = count, className, ...props }: UsageDialProps
) {
  const reduced = useReducedMotion()
  const share = limit === null || limit === 0 ? 0 : Math.min(1, used / limit)
  const level = limit === null ? "normal" : usageLevel(used, limit)
  const day = Math.min(1, Math.max(0, dayGone))

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          polar({
            inset: 0,
            marks: [
              arc("day-track", 1, DAY, TRACK),
              arc("day", day, DAY, CLOCK),
              arc("used-track", 1, USED, TRACK),
              ...(share > 0 ? [arc("used", share, USED, TONE[level])] : [])
            ],
            scales: { angle: null, radius: null }
          })
        ],
        scales: { x: null, y: null },
        margin: 0,
        keyboard: false,
        svgAnimation: !reduced
      }),
    [day, share, level, reduced]
  )

  return (
    <figure
      data-slot="usage-dial"
      data-level={level}
      className={cn("grid justify-items-center gap-3", className)}
      {...props}
    >
      {/* The caption carries these numbers for assistive tech, so the rings themselves are hidden from it. */}
      <div aria-hidden className="relative" style={{ width: SIZE, height: SIZE }}>
        <Chart definition={definition} width={SIZE} height={SIZE} tabIndex={-1} ariaLabel={label} />
        <div className="pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-1 text-center">
          <NumberRoll
            value={limit === null ? used : Math.max(0, limit - used)}
            format={format}
            className="text-[30px] leading-none font-semibold tracking-[-0.035em]"
          />
          <span className="max-w-[112px] text-caption text-g-500 tabular-nums">
            {limit === null ? "used today" : `left of ${format(limit)}`}
          </span>
        </div>
      </div>
      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-label-sm text-g-600">
        <span className="sr-only">
          {limit === null ? `${label}: ${format(used)} used.` : `${label}: ${format(used)} of ${format(limit)} used.`}
        </span>
        {limit === null ? null : (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="size-2 rounded-full" style={{ background: TONE[level] }} />
            Used <b className="font-semibold text-ink tabular-nums">{percent(share)}</b>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="size-2 rounded-full" style={{ background: CLOCK }} />
          Day gone <b className="font-semibold text-ink tabular-nums">{percent(day)}</b>
        </span>
      </figcaption>
    </figure>
  )
}
