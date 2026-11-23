import { useState } from "react"
import { cn } from "../lib/cn.ts"

export interface AllocationSlice {
  /** A stable id: the symbol, or `cash`. Cash always takes the cash series color. */
  readonly id: string
  readonly label: string
  /** Share of your money now, 0 to 100. */
  readonly current: number
  /** The share you asked for, 0 to 100. */
  readonly target: number
}

/** How far a mix is from its target: half the sum of every gap, so moving 5% from one stock to another is 5%. */
export const offTarget = (slices: ReadonlyArray<AllocationSlice>): number =>
  slices.reduce((sum, s) => sum + Math.abs(s.current - s.target), 0) / 2

const colorOf = (slice: AllocationSlice, index: number) =>
  slice.id === "cash" ? "var(--color-series-cash)" : `var(--color-series-${(index % 8) + 1})`

const C = 200, MID = C / 2, GAP = 2.2

function Ring(
  { radius, width, slices, field, focus }: {
    readonly radius: number
    readonly width: number
    readonly slices: ReadonlyArray<AllocationSlice>
    readonly field: "current" | "target"
    readonly focus: string | null
  }
) {
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return slices.map((slice, i) => {
    const length = Math.max(0, (slice[field] / 100) * circumference - GAP)
    const dashoffset = -offset
    offset += (slice[field] / 100) * circumference
    return (
      <circle
        key={slice.id}
        cx={MID}
        cy={MID}
        r={radius}
        fill="none"
        stroke={colorOf(slice, i)}
        strokeWidth={width}
        strokeDasharray={`${length.toFixed(2)} ${(circumference - length).toFixed(2)}`}
        strokeDashoffset={dashoffset.toFixed(2)}
        transform={`rotate(-90 ${MID} ${MID})`}
        className={cn(
          "transition-[stroke-dasharray,stroke-dashoffset,opacity] duration-[600ms] ease-brand",
          focus !== null && focus !== slice.id && "opacity-20"
        )}
      />
    )
  })
}

export interface AllocationDonutProps {
  readonly slices: ReadonlyArray<AllocationSlice>
  readonly className?: string
}

/**
 * Your mix now (outer ring) against the mix you asked for (inner ring), in the chart series colors. The center says
 * how far off you are. Hover or focus a legend row to isolate it.
 */
export function AllocationDonut({ slices, className }: AllocationDonutProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const focus = hovered ?? pinned
  const off = offTarget(slices)
  return (
    <div
      data-slot="allocation-donut"
      className={cn("flex w-full max-w-[640px] flex-wrap items-center justify-center gap-8", className)}
    >
      <div className="relative size-[200px] shrink-0">
        <svg viewBox={`0 0 ${C} ${C}`} width={C} height={C} aria-hidden className="block">
          <circle cx={MID} cy={MID} r="84" fill="none" stroke="var(--color-g-100)" strokeWidth="14" />
          <Ring radius={84} width={14} slices={slices} field="current" focus={focus} />
          <Ring radius={64} width={6} slices={slices} field="target" focus={focus} />
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="text-caption text-g-600">Off target</span>
          <b className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] tabular-nums">{off.toFixed(1)}%</b>
          <span className="max-w-[104px] text-[11.5px] text-g-500">
            {off < 1 ? "On target" : off < 5 ? "Inside 5% band" : "Time to rebalance"}
          </span>
        </div>
      </div>
      <ul aria-label="Your mix against your target" className="grid min-w-[min(100%,300px)] flex-1 gap-0.5">
        {slices.map((slice, i) => {
          const gap = slice.current - slice.target
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
                  "grid w-full cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto_auto_64px] items-center gap-2.5 rounded-sm px-2.5 py-[7px] text-left text-[13.5px] outline-none transition-colors duration-fast ease-brand",
                  "focus-visible:ring-focus",
                  focus === slice.id && "bg-white shadow-e1"
                )}
              >
                <i
                  aria-hidden
                  className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_rgba(10,11,13,.1)]"
                  style={{ background: colorOf(slice, i) }}
                />
                <span className="font-[550]">{slice.label}</span>
                <span className="font-semibold tabular-nums">{slice.current.toFixed(1)}%</span>
                <span className="text-label-sm text-g-500 tabular-nums">target {slice.target}%</span>
                <span
                  className={cn(
                    "text-right text-label-sm font-semibold tabular-nums",
                    on ? "text-g-500" : gap > 0 ? "text-loss" : "text-blue"
                  )}
                >
                  {on ? "on target" : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
