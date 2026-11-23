import { type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useId, useState } from "react"
import { Skeleton } from "../components/skeleton.tsx"
import { Tabs, TabsList, TabsPanel, TabsTab } from "../components/tabs.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { PriceChange } from "./price-change.tsx"

export interface PortfolioPoint {
  readonly value: number
  /** When it was, as people read it: "Tue 24 Nov" or "14:30". */
  readonly label: string
}

export interface PortfolioRange {
  /** The tab: "1D", "1W", "1M", "All". */
  readonly id: string
  /** What the headline says when nothing is hovered: "Past month". */
  readonly description: string
  readonly points: ReadonlyArray<PortfolioPoint>
}

export interface PortfolioChartProps {
  readonly ranges: ReadonlyArray<PortfolioRange>
  readonly defaultRange?: string
  readonly title?: ReactNode
  /** Shown after the title, like an "Example" flag. */
  readonly titleAddon?: ReactNode
  /** Shows a skeleton instead of the chart. */
  readonly loading?: boolean
  readonly className?: string
}

const PAD_TOP = 14, PAD_BOTTOM = 26, PAD_RIGHT = 10

/**
 * Your total value over time in Base Blue, with the starting value dashed for reference. Ranges are tabs. Hover, or
 * focus the chart and use ← → Home End, to read any point; the headline and a screen reader follow along.
 */
export function PortfolioChart(
  { ranges, defaultRange, title = "Total value", titleAddon, loading = false, className }: PortfolioChartProps
) {
  const [rangeId, setRangeId] = useState(defaultRange ?? ranges.at(-1)?.id ?? "")
  const [index, setIndex] = useState<number | null>(null)
  const [width, setWidth] = useState(600)
  const gradient = useId()
  // A callback ref, so the observer follows whichever element (chart, skeleton, empty state) is mounted.
  const plot = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const range = ranges.find((r) => r.id === rangeId) ?? ranges[0]
  const points = range?.points ?? []
  const last = points.length - 1
  const current = index === null ? points.at(-1) : points[index]
  const base = points[0]?.value ?? 0

  const height = width < 480 ? 180 : 230
  const values = points.map((p) => p.value)
  const pad = (Math.max(...values) - Math.min(...values)) * 0.12 || 1
  const min = Math.min(...values) - pad, max = Math.max(...values) + pad
  const x = (i: number) => (i / Math.max(1, last)) * (width - PAD_RIGHT)
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (height - PAD_TOP - PAD_BOTTOM)
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ")
  const ticks = [...new Set((width < 480 ? [0, 1] : [0, 0.33, 0.66, 1]).map((f) => Math.round(f * last)))]

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const f = (event.clientX - rect.left) / (width - PAD_RIGHT)
    setIndex(Math.max(0, Math.min(last, Math.round(f * last))))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = index ?? last
    const next = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: last }[event.key]
    if (next === undefined) {
      if (event.key === "Escape") setIndex(null)
      return
    }
    event.preventDefault()
    setIndex(Math.max(0, Math.min(last, next)))
  }

  const tip = index === null ? null : points[index]
  const tipX = index === null ? 0 : x(index)

  return (
    <div
      data-slot="portfolio-chart"
      className={cn("w-full rounded-lg bg-white px-5 pt-5 pb-3 shadow-e2", className)}
    >
      <Tabs
        variant="segmented"
        value={rangeId}
        onValueChange={(value) => {
          setRangeId(String(value))
          setIndex(null)
        }}
        className="gap-3.5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <span className="flex items-center gap-1.5 text-label text-g-600">{title}{titleAddon}</span>
            {loading ?
              <Skeleton className="h-9 w-48" /> :
              (
                <NumberRoll
                  value={current?.value ?? 0}
                  format={(v) => formatMoney(v)}
                  className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em]"
                />
              )}
            {!loading && current && (
              <span className="flex flex-wrap items-center gap-2">
                <PriceChange
                  value={base === 0 ? 0 : ((current.value - base) / base) * 100}
                  amount={current.value - base}
                />
                <span className="text-label-sm text-g-500">{index === null ? range?.description : current.label}</span>
              </span>
            )}
          </div>
          <TabsList aria-label="Chart range" className={cn(ranges.length < 2 && "hidden")}>
            {ranges.map((r) => <TabsTab key={r.id} value={r.id}>{r.id}</TabsTab>)}
          </TabsList>
        </div>
        <TabsPanel value={rangeId} className="min-w-0 focus-visible:outline-none">
          {loading ?
            (
              <div ref={plot} aria-busy className="flex h-[120px] items-end gap-1.5">
                {[40, 65, 85, 55, 75].map((h) => <Skeleton key={h} className="flex-1" style={{ height: `${h}%` }} />)}
              </div>
            ) :
            points.length < 2 ?
            (
              <div ref={plot} className="grid justify-items-start gap-1 py-10">
                <Icon name="chart-line" size={18} className="mb-1 text-g-400" />
                <b className="text-[13.5px] font-semibold">Your chart starts with your first deposit</b>
                <span className="text-label-sm text-g-500">Add cash to see how your money moves.</span>
              </div>
            ) :
            (
              <div
                ref={plot}
                tabIndex={0}
                // The crosshair is a slider over the points: arrow keys move it, and screen readers read each
                // point's value and date as it changes. A native range input can't draw the chart.
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
                role="slider"
                aria-roledescription="chart"
                aria-label="Portfolio value"
                aria-valuemin={0}
                aria-valuemax={last}
                aria-valuenow={index ?? last}
                aria-valuetext={`${formatMoney((tip ?? points[last])?.value ?? 0)}, ${
                  (tip ?? points[last])?.label ?? ""
                }`}
                onPointerMove={onPointerMove}
                onPointerLeave={() => setIndex(null)}
                onBlur={() => setIndex(null)}
                onKeyDown={onKeyDown}
                className="relative w-full min-w-0 cursor-crosshair touch-pan-y rounded-md outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-blue)]"
              >
                <svg
                  width="100%"
                  height={height}
                  viewBox={`0 0 ${width} ${height}`}
                  aria-hidden
                  className="block overflow-visible"
                >
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--color-blue)" stopOpacity=".16" />
                      <stop offset=".7" stopColor="var(--color-blue)" stopOpacity=".03" />
                      <stop offset="1" stopColor="var(--color-blue)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map((f) => {
                    const gy = PAD_TOP + f * (height - PAD_TOP - PAD_BOTTOM)
                    return <line key={f} x1="0" x2={width} y1={gy} y2={gy} stroke="var(--color-g-100)" />
                  })}
                  <line x1="0" x2={width} y1={y(base)} y2={y(base)} stroke="var(--color-g-300)" strokeDasharray="2 4" />
                  <path
                    d={`${line} L${x(last)} ${height - PAD_BOTTOM} L0 ${height - PAD_BOTTOM}Z`}
                    fill={`url(#${gradient})`}
                  />
                  <path
                    d={line}
                    fill="none"
                    stroke="var(--color-blue)"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className="drop-shadow-[0_2px_3px_rgba(0,0,255,.2)]"
                  />
                  {ticks.map((i, k) => (
                    <text
                      key={i}
                      x={x(i)}
                      y={height - 6}
                      textAnchor={k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle"}
                      className="fill-g-500 text-caption-sm"
                    >
                      {points[i]?.label}
                    </text>
                  ))}
                  <circle cx={x(last)} cy={y(values[last] ?? 0)} r="9" fill="var(--color-blue)" opacity=".14" />
                  <circle
                    cx={x(last)}
                    cy={y(values[last] ?? 0)}
                    r="4"
                    fill="var(--color-blue)"
                    stroke="#fff"
                    strokeWidth="2"
                  />
                  {tip && (
                    <g data-slot="portfolio-chart-crosshair">
                      <line
                        x1={tipX}
                        x2={tipX}
                        y1={PAD_TOP - 6}
                        y2={height - PAD_BOTTOM}
                        stroke="var(--color-ink)"
                        strokeOpacity=".25"
                      />
                      <circle
                        cx={tipX}
                        cy={y(tip.value)}
                        r="4.5"
                        fill="#fff"
                        stroke="var(--color-blue)"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>
                {tip && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute grid -translate-x-1/2 rounded-[9px] bg-ink px-2.5 py-1.5 whitespace-nowrap text-white shadow-[0_6px_16px_-4px_rgba(10,11,13,.35)]"
                    style={{
                      left: Math.max(60, Math.min(width - 60, tipX)),
                      top: Math.max(0, y(tip.value) - 52)
                    }}
                  >
                    <b className="text-label font-semibold tabular-nums">{formatMoney(tip.value)}</b>
                    <span className="text-[11.5px] text-white/70">{tip.label}</span>
                  </div>
                )}
              </div>
            )}
        </TabsPanel>
      </Tabs>
    </div>
  )
}
