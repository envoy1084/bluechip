import { type ReactNode, useEffect, useId, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, useActiveTooltipDataPoints, XAxis, YAxis } from "recharts"
import { type ChartConfig, ChartContainer, ChartTooltip } from "../components/chart.tsx"
import { Skeleton } from "../components/skeleton.tsx"
import { Tabs, TabsList, TabsPanel, TabsTab } from "../components/tabs.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"
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

interface PlotPoint extends PortfolioPoint {
  readonly index: number
}

const CONFIG: ChartConfig = { value: { label: "Total value", color: "var(--color-blue)" } }
const BLUE = "var(--color-blue)"

/** Reports the point under the crosshair (pointer or keyboard), so the headline can follow it. */
function ActivePoint({ onChange }: { readonly onChange: (index: number | null) => void }) {
  const index = useActiveTooltipDataPoints<PlotPoint>()?.[0]?.index ?? null
  useEffect(() => onChange(index), [index, onChange])
  return null
}

const NO_POINTS: ReadonlyArray<never> = []

function CrosshairTooltip(
  { active = false, payload = NO_POINTS, accessibilityLayer = false }: {
    readonly active?: boolean
    readonly payload?: ReadonlyArray<{ readonly payload?: PlotPoint }>
    readonly accessibilityLayer?: boolean
  }
) {
  const point = payload[0]?.payload
  if (!active || !point) return null
  return (
    <div
      data-slot="portfolio-chart-tooltip"
      {...(accessibilityLayer ? { role: "status", "aria-live": "polite" } : {})}
      className="pointer-events-none grid rounded-[9px] bg-ink px-2.5 py-1.5 whitespace-nowrap text-white shadow-e3"
    >
      <b className="text-label font-semibold tabular-nums">{formatMoney(point.value)}</b>
      <span className="text-[11.5px] text-white/70">{point.label}</span>
    </div>
  )
}

/** An x-axis label; the first and last align to the plot's edges instead of hanging past them. */
function EdgeTick(
  { x, y, payload, first, last }: {
    readonly x?: number | string
    readonly y?: number | string
    // `coordinate` is the point's own x; Recharts nudges `x` inward for centered edge labels, which we don't center.
    readonly payload?: { readonly value?: unknown; readonly coordinate?: number }
    readonly first?: string | undefined
    readonly last?: string | undefined
  }
) {
  const value = payload?.value
  const edge = value === first ? "start" : value === last ? "end" : undefined
  return (
    <text
      x={edge ? payload?.coordinate ?? x : x}
      y={y}
      dy={10}
      textAnchor={edge ?? "middle"}
      className="fill-g-500 text-caption-sm"
    >
      {String(value ?? "")}
    </text>
  )
}

/** Only the latest point gets a dot, with a soft halo: "you are here". */
function EndDot(
  { cx, cy, index, last }: {
    readonly cx?: number
    readonly cy?: number
    readonly index?: number
    readonly last: number
  }
) {
  if (index !== last) return <g />
  return (
    <g data-slot="portfolio-chart-end">
      <circle cx={cx} cy={cy} r={9} fill={BLUE} opacity={0.14} />
      <circle cx={cx} cy={cy} r={4} fill={BLUE} stroke="#fff" strokeWidth={2} />
    </g>
  )
}

/**
 * Your total value over time in brand blue, with the starting value dashed for reference. Ranges are tabs. Hover, or
 * focus the chart and use ← →, to read any point; the headline follows and a screen reader hears each one.
 */
export function PortfolioChart(
  { ranges, defaultRange, title = "Total value", titleAddon, loading = false, className }: PortfolioChartProps
) {
  const [rangeId, setRangeId] = useState(defaultRange ?? ranges.at(-1)?.id ?? "")
  const [index, setIndex] = useState<number | null>(null)
  const reduced = useReducedMotion()
  const gradient = useId().replace(/[^a-zA-Z0-9]/g, "")

  const range = ranges.find((r) => r.id === rangeId) ?? ranges[0]
  const data = useMemo(
    () => (range?.points ?? []).map((point, i): PlotPoint => ({ ...point, index: i })),
    [range]
  )
  const current = index === null ? data.at(-1) : data[index]
  const base = data[0]?.value ?? 0
  const values = data.map((p) => p.value)
  const pad = (Math.max(...values) - Math.min(...values)) * 0.12 || 1
  // First, a third, two thirds and last; recharts drops the middle ones when they would collide.
  const ticks = [...new Set([0, 1 / 3, 2 / 3, 1].map((f) => data[Math.round(f * (data.length - 1))]?.label ?? ""))]

  return (
    <div
      data-slot="portfolio-chart"
      // The plot's height follows the card's width (container units), 180 px on phones up to 230 px.
      style={{ containerType: "inline-size" }}
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
              <div aria-busy className="flex h-[120px] items-end gap-1.5">
                {[40, 65, 85, 55, 75].map((h) => <Skeleton key={h} className="flex-1" style={{ height: `${h}%` }} />)}
              </div>
            ) :
            data.length < 2 ?
            (
              <div className="grid justify-items-start gap-1 py-10">
                <Icon name="chart-line" size={18} className="mb-1 text-g-400" />
                <b className="text-[13.5px] font-semibold">Your chart starts with your first deposit</b>
                <span className="text-label-sm text-g-500">Add cash to see how your money moves.</span>
              </div>
            ) :
            (
              <ChartContainer
                config={CONFIG}
                style={{ height: "clamp(180px, 45cqw, 230px)" }}
                className="cursor-crosshair touch-pan-y [&_.recharts-cartesian-axis-tick_text]:fill-g-500"
              >
                <AreaChart
                  // A fresh chart per range, so the crosshair doesn't carry over.
                  key={rangeId}
                  data={data}
                  margin={{ top: 14, right: 10, bottom: 0, left: 0 }}
                  title="Portfolio value"
                >
                  <defs>
                    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={BLUE} stopOpacity={0.16} />
                      <stop offset="0.7" stopColor={BLUE} stopOpacity={0.03} />
                      <stop offset="1" stopColor={BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    ticks={ticks}
                    tick={<EdgeTick first={data[0]?.label} last={data.at(-1)?.label} />}
                    interval="preserveStartEnd"
                    minTickGap={48}
                  />
                  <YAxis hide domain={[Math.min(...values) - pad, Math.max(...values) + pad]} />
                  <ReferenceLine y={base} strokeDasharray="2 4" />
                  <ChartTooltip
                    cursor={{ stroke: "var(--color-ink)", strokeOpacity: 0.25 }}
                    isAnimationActive={false}
                    offset={14}
                    content={<CrosshairTooltip />}
                  />
                  <Area
                    dataKey="value"
                    type="linear"
                    stroke={BLUE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    fill={`url(#${gradient})`}
                    // Recharts clones the element with each point's position and index.
                    dot={<EndDot last={data.length - 1} />}
                    activeDot={{ r: 4.5, fill: "#fff", stroke: BLUE, strokeWidth: 2 }}
                    isAnimationActive={!reduced}
                  />
                  <ActivePoint onChange={setIndex} />
                </AreaChart>
              </ChartContainer>
            )}
        </TabsPanel>
      </Tabs>
    </div>
  )
}
