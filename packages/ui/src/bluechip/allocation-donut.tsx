import { defineChart } from "@tanstack/charts"
import { pie, polar, radialArc } from "@tanstack/charts/polar"
import { Chart } from "@tanstack/charts/react"
import { useMemo, useState } from "react"
import { cn } from "../lib/cn.ts"
import { tickerColors } from "../lib/tickers.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"

export interface AllocationSlice {
  /** A stable id: the symbol, or `cash`. */
  readonly id: string
  readonly label: string
  /** Share of your money now, 0 to 100. */
  readonly current: number
  /** The share you asked for, 0 to 100; leave it out to show the mix alone. */
  readonly target?: number
}

/** How far a mix is from its target: half the sum of every gap, so moving 5% from one stock to another is 5%. */
export const offTarget = (slices: ReadonlyArray<AllocationSlice>): number =>
  slices.reduce((sum, s) => sum + Math.abs(s.current - (s.target ?? s.current)), 0) / 2

/** What the center says about how far off the mix is: on target under 1%, inside the band under 5%. */
export const offTargetAdvice = (off: number): string =>
  off < 1 ? "On target" : off < 5 ? "Inside 5% band" : "Time to rebalance"

/** A legend row's gap from its target, in points: "+7.0", "−5.0", or "on target" within half a point. */
export const targetGap = (slice: AllocationSlice): string => {
  const gap = slice.current - (slice.target ?? slice.current)
  return Math.abs(gap) < 0.5 ? "on target" : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}`
}

const CASH = "#c3c8d2"
const TRACK = "#f1f2f5"

/** A slice's color: the company's own (as on its ticker chip), cash in grey. */
const colorOf = (slice: AllocationSlice) => (slice.id === "cash" ? CASH : tickerColors(slice.id).bottom)

// The kit's figure: 200 px, a 14 px ring at radius 84 (now) and a 6 px ring at radius 64 (target).
const SIZE = 200
const NOW = { inner: 77, outer: 91 }
const TARGET = { inner: 61, outer: 67 }
// The kit's 2.2 px gap between slices, as an angle on the outer ring.
const GAP = 2.2 / 84

const ring = (
  slices: ReadonlyArray<AllocationSlice>,
  field: "current" | "target",
  radii: { readonly inner: number; readonly outer: number },
  focus: string | null
) =>
  radialArc(
    pie(
      slices.map((slice) => ({ id: slice.id, color: colorOf(slice), value: slice[field] ?? 0 })).filter((row) =>
        row.value > 0
      ),
      { value: "value", gapAngle: GAP }
    ),
    {
      id: field,
      key: "id",
      innerRadius: radii.inner,
      outerRadius: radii.outer,
      // Isolating a slice fades the others, like the kit.
      fill: (
        row
      ) => (focus === null || focus === row.id ? row.color : `color-mix(in srgb, ${row.color} 18%, transparent)`)
    }
  )

/**
 * Your mix now (outer ring) against the mix you asked for (inner ring), in each company's color, cash in grey. The
 * center says how far off you are; without targets it shows the mix alone and names the biggest slice. Hover or focus a
 * legend row to isolate it; press it to keep it isolated.
 */
export function AllocationDonut(
  { slices, className }: { readonly slices: ReadonlyArray<AllocationSlice>; readonly className?: string }
) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const reduced = useReducedMotion()

  const focus = hovered ?? pinned
  const targeted = slices.some((slice) => slice.target !== undefined)
  const off = offTarget(slices)
  const biggest = slices.reduce<AllocationSlice | undefined>(
    (top, slice) => (top === undefined || slice.current > top.current ? slice : top),
    undefined
  )

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          polar({
            inset: 0,
            marks: [
              radialArc(pie([{ id: "track", value: 1 }], { value: "value" }), {
                id: "track",
                key: "id",
                innerRadius: NOW.inner,
                outerRadius: NOW.outer,
                fill: TRACK
              }),
              ring(slices, "current", NOW, focus),
              ...(targeted ? [ring(slices, "target", TARGET, focus)] : [])
            ],
            scales: { angle: null, radius: null }
          })
        ],
        scales: { x: null, y: null },
        margin: 0,
        keyboard: false,
        svgAnimation: !reduced
      }),
    [slices, focus, targeted, reduced]
  )

  return (
    <div
      data-slot="allocation-donut"
      className={cn("flex w-full max-w-[640px] flex-wrap items-center justify-center gap-8", className)}
    >
      {/* The legend is the accessible view of these numbers, so the figure itself is hidden from assistive tech. */}
      <div aria-hidden className="relative size-[200px] shrink-0">
        <Chart
          definition={definition}
          width={SIZE}
          height={SIZE}
          tabIndex={-1}
          ariaLabel="Your mix"
          onFocusChange={(point) =>
            setHovered(point === null ? null : String((point.datum as { readonly id: string }).id))}
        />
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {targeted ?
            (
              <>
                <span className="text-caption font-medium text-g-500">Off target</span>
                <b className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] tabular-nums">
                  {off.toFixed(1)}%
                </b>
                <span className="max-w-[104px] text-[11.5px] text-g-500">
                  {offTargetAdvice(off)}
                </span>
              </>
            ) :
            biggest !== undefined && (
              <>
                <span className="text-caption font-medium text-g-500">Biggest</span>
                <b className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] tabular-nums">
                  {biggest.current.toFixed(1)}%
                </b>
                <span className="max-w-[104px] text-[11.5px] text-g-500">{biggest.label}</span>
              </>
            )}
        </div>
      </div>

      <ul
        aria-label={targeted ? "Your mix against your target" : "Your mix"}
        className="grid min-w-[min(100%,300px)] flex-1 gap-0.5"
      >
        {slices.map((slice) => {
          const gap = slice.current - (slice.target ?? slice.current)
          const on = Math.abs(gap) < 0.5
          return (
            <li key={slice.id}>
              <button
                type="button"
                aria-pressed={pinned === slice.id}
                onClick={() => setPinned(pinned === slice.id ? null : slice.id)}
                onPointerEnter={() => setHovered(slice.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(slice.id)}
                onBlur={() => setHovered(null)}
                className={cn(
                  targeted ? "grid-cols-[10px_minmax(0,1fr)_auto_auto_64px]" : "grid-cols-[10px_minmax(0,1fr)_auto]",
                  "grid w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-left text-[13.5px] outline-none transition-colors duration-fast ease-brand",
                  "hover:bg-blue/10 hover:text-blue focus-visible:bg-blue/10 focus-visible:text-blue focus-visible:ring-focus",
                  focus === slice.id && "bg-blue/10 text-blue"
                )}
              >
                <i
                  aria-hidden
                  className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(10,11,13,.1)]"
                  style={{ background: colorOf(slice) }}
                />
                <span className="font-[550]">{slice.label}</span>
                <span className="font-semibold tabular-nums">{slice.current.toFixed(1)}%</span>
                {slice.target !== undefined && (
                  <>
                    <span className="text-[12.5px] text-g-500 tabular-nums">target {slice.target}%</span>
                    <span
                      className={cn(
                        "text-right text-[12.5px] font-semibold tabular-nums",
                        on ? "text-g-500" : gap > 0 ? "text-loss" : "text-blue"
                      )}
                    >
                      {targetGap(slice)}
                    </span>
                  </>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
