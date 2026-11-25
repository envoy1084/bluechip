import { useState } from "react"
import { Pie, PieChart, type PieSectorShapeProps, Sector } from "recharts"
import { cn } from "../lib/cn.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"

export interface AllocationSlice {
  /** A stable id: the symbol, or `cash`. Cash always takes the cash series color. */
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

const colorOf = (slice: AllocationSlice, index: number) =>
  slice.id === "cash" ? "var(--color-series-cash)" : `var(--color-series-${(index % 8) + 1})`

const SIZE = 200

export interface AllocationDonutProps {
  readonly slices: ReadonlyArray<AllocationSlice>
  readonly className?: string
}

/**
 * Your mix now (outer ring) against the mix you asked for (inner ring), in the chart series colors. The center says
 * how far off you are; without targets it shows the mix alone and the center names the biggest slice. Hover a slice, or hover or focus a legend row, to isolate it; press a row to keep it isolated.
 */
export function AllocationDonut({ slices, className }: AllocationDonutProps) {
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

  const ring = (field: "current" | "target") =>
    slices
      .map((slice, i) => ({ id: slice.id, value: slice[field] ?? 0, fill: colorOf(slice, i) }))
      .filter((entry) => entry.value > 0)
  const sector = (props: PieSectorShapeProps) => {
    const id = (props.payload as { readonly id?: string } | undefined)?.id
    return (
      <Sector
        cx={props.cx}
        cy={props.cy}
        innerRadius={props.innerRadius}
        outerRadius={props.outerRadius}
        startAngle={props.startAngle}
        endAngle={props.endAngle}
        fill={props.fill ?? "currentColor"}
        className={cn(
          "transition-opacity duration-slow ease-brand",
          focus !== null && focus !== id && "opacity-20"
        )}
      />
    )
  }
  const rings = { startAngle: 90, endAngle: -270, paddingAngle: 1.5, stroke: "none", isAnimationActive: !reduced }

  return (
    <div
      data-slot="allocation-donut"
      className={cn("flex w-full max-w-[640px] flex-wrap items-center justify-center gap-8", className)}
    >
      <div className="relative size-[200px] shrink-0" aria-hidden>
        {/* The legend is the accessible view of these numbers, so the chart itself takes no focus. */}
        <PieChart
          width={SIZE}
          height={SIZE}
          accessibilityLayer={false}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Pie
            data={[{ value: 100 }]}
            dataKey="value"
            innerRadius={77}
            outerRadius={91}
            fill="var(--color-g-100)"
            stroke="none"
            isAnimationActive={false}
          />
          <Pie
            data={ring("current")}
            dataKey="value"
            innerRadius={77}
            outerRadius={91}
            shape={sector}
            onMouseEnter={(entry) => setHovered((entry.payload as { readonly id: string }).id)}
            onMouseLeave={() => setHovered(null)}
            {...rings}
          />
          {targeted && (
            <Pie
              data={ring("target")}
              dataKey="value"
              innerRadius={61}
              outerRadius={67}
              shape={sector}
              {...rings}
            />
          )}
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {targeted ?
            (
              <>
                <span className="text-caption text-g-600">Off target</span>
                <b className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] tabular-nums">
                  {off.toFixed(1)}%
                </b>
                <span className="max-w-[104px] text-[11.5px] text-g-500">
                  {off < 1 ? "On target" : off < 5 ? "Inside 5% band" : "Time to rebalance"}
                </span>
              </>
            ) :
            biggest !== undefined && (
              <>
                <span className="text-caption text-g-600">Biggest</span>
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
        {slices.map((slice, i) => {
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
                  "focus-visible:ring-focus",
                  focus === slice.id && "bg-white shadow-e1"
                )}
              >
                <i
                  aria-hidden
                  className="size-2.5 rounded-[3px] shadow-hair"
                  style={{ background: colorOf(slice, i) }}
                />
                <span className="font-[550]">{slice.label}</span>
                <span className="font-semibold tabular-nums">{slice.current.toFixed(1)}%</span>
                {slice.target !== undefined && (
                  <>
                    <span className="text-label-sm text-g-500 tabular-nums">target {slice.target}%</span>
                    <span
                      className={cn(
                        "text-right text-label-sm font-semibold tabular-nums",
                        on ? "text-g-500" : gap > 0 ? "text-loss" : "text-blue"
                      )}
                    >
                      {on ? "on target" : `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}`}
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
