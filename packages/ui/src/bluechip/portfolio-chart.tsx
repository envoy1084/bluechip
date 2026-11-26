import { areaY, crosshair, defineChart, dot, lineY, ruleY } from "@tanstack/charts"
import { decorative } from "@tanstack/charts/mark/decorative"
import { Chart } from "@tanstack/charts/react/tooltip"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { type ReactNode, useMemo, useState } from "react"
import { Skeleton } from "../components/skeleton.tsx"
import { Tabs, TabsList, TabsPanel, TabsTab } from "../components/tabs.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatChange, formatMoney } from "../lib/format.ts"
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
  /** Shown after the title, such as a status tag. */
  readonly titleAddon?: ReactNode
  /** Shows a skeleton instead of the chart. */
  readonly loading?: boolean
  /**
   * What the points are: a value (`value`, the default: the headline's change since the range's start, in dollars and
   * percent) or a profit or loss (`profit`: signed amounts, no percent).
   */
  readonly measure?: "value" | "profit"
  readonly className?: string
}

interface PlotPoint extends PortfolioPoint {
  readonly index: number
}

const BLUE = "#2a5bff"
const INK = "#0a0b0d"

/** The chart for one range: area and line in brand blue, the start dashed, the latest point marked. */
const definitionFor = (rows: ReadonlyArray<PlotPoint>, animate: boolean, format: (value: number) => string) => {
  const values = rows.map((row) => row.value)
  const pad = (Math.max(...values) - Math.min(...values)) * 0.12 || 1
  const low = Math.min(...values) - pad
  const high = Math.max(...values) + pad
  const base = rows[0]?.value ?? 0
  const last = rows.slice(-1)

  // First, a third, two thirds and last, as indexes; their labels are the points' own.
  const ticks = [...new Set([0, 1 / 3, 2 / 3, 1].map((share) => Math.round(share * (rows.length - 1))))]

  return defineChart({
    marks: [
      decorative(
        areaY(rows, { id: "area", x: "index", y1: low, y2: "value", fill: "url(#portfolio-fill)", fillOpacity: 1 })
      ),
      decorative(
        ruleY([base], { id: "start", y: (value) => value, stroke: INK, strokeOpacity: 0.28, strokeDasharray: "2 4" })
      ),
      lineY(rows, { id: "value", x: "index", y: "value", stroke: BLUE, strokeWidth: 2, key: "index" }),
      decorative(dot(last, { id: "end-halo", x: "index", y: "value", r: 9, fill: BLUE, fillOpacity: 0.14 })),
      decorative(dot(last, { id: "end", x: "index", y: "value", r: 4, fill: BLUE, stroke: "#fff", strokeWidth: 2 })),
      crosshair({ x: { stroke: INK, strokeOpacity: 0.25 }, y: false, marker: true })
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([0, Math.max(rows.length - 1, 1)]),
        axis: {
          line: false,
          ticks: { values: ticks, size: 0, padding: 8, format: (index) => rows[index]?.label ?? "" },
          tickLabels: { anchor: ({ index }) => (index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle") }
        }
      },
      y: {
        scale: scaleLinear().domain([low, high]),
        axis: false,
        grid: { stroke: INK, strokeOpacity: 0.06 }
      }
    },
    margin: { top: 14, right: 10, left: 0 },
    gradients: [{
      id: "portfolio-fill",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      stops: [
        { offset: 0, color: BLUE, opacity: 0.16 },
        { offset: 0.7, color: BLUE, opacity: 0.03 },
        { offset: 1, color: BLUE, opacity: 0 }
      ]
    }],
    focus: "nearest-x",
    maxFocusDistance: Number.POSITIVE_INFINITY,
    tooltip: {
      use: tooltip,
      offset: 14,
      sticky: false,
      // What screen readers hear; the visible bubble is `TooltipBody`.
      format: (point) => `${format(point.datum.value)}, ${point.datum.label}`
    },
    svgAnimation: animate
  })
}

/** The dark bubble under the crosshair: the value and when. */
function TooltipBody(
  { format, point }: { readonly point: PlotPoint | undefined; readonly format: (value: number) => string }
): ReactNode {
  if (point === undefined) return null
  return (
    <div
      data-slot="portfolio-chart-tooltip"
      className="grid rounded-[9px] bg-ink px-2.5 py-1.5 whitespace-nowrap text-white shadow-e3"
    >
      <b className="text-label font-semibold tabular-nums">{format(point.value)}</b>
      <span className="text-[11.5px] text-white/70">{point.label}</span>
    </div>
  )
}

/**
 * Your total value (or profit) over time in brand blue, with the starting value dashed for reference. Ranges are tabs. Hover, or
 * focus the chart and use ← →, to read any point; the headline follows.
 */
export function PortfolioChart(
  { ranges, defaultRange, title = "Total value", titleAddon, loading = false, measure = "value", className }:
    PortfolioChartProps
) {
  const format = measure === "profit" ? formatChange : formatMoney
  const [rangeId, setRangeId] = useState(defaultRange ?? ranges.at(-1)?.id ?? "")
  const [index, setIndex] = useState<number | null>(null)
  const reduced = useReducedMotion()

  const range = ranges.find((r) => r.id === rangeId) ?? ranges[0]
  const rows = useMemo(
    () => (range?.points ?? []).map((point, i): PlotPoint => ({ ...point, index: i })),
    [range]
  )
  const definition = useMemo(
    () => (rows.length < 2 ? undefined : definitionFor(rows, !reduced, format)),
    [rows, reduced, format]
  )

  const current = index === null ? rows.at(-1) : rows[index]
  const base = rows[0]?.value ?? 0

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
                  format={format}
                  className="text-[32px] leading-[1.1] font-semibold tracking-[-0.035em]"
                />
              )}
            {!loading && current && (
              <span className="flex flex-wrap items-center gap-2">
                {measure === "value" && (
                  <PriceChange
                    value={base === 0 ? 0 : ((current.value - base) / base) * 100}
                    amount={current.value - base}
                  />
                )}
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
            definition === undefined ?
            (
              <div className="grid justify-items-start gap-1 py-10">
                <Icon name="chart-line" size={18} className="mb-1 text-g-400" />
                {measure === "profit" ?
                  (
                    <>
                      <b className="text-[13.5px] font-semibold">Your results start with your first trade</b>
                      <span className="text-label-sm text-g-500">Each day's profit and loss lands here.</span>
                    </>
                  ) :
                  rows.length === 1 && rows[0]!.value > 0 ?
                  (
                    <>
                      <b className="text-[13.5px] font-semibold">Your chart starts building today</b>
                      <span className="text-label-sm text-g-500">A new point lands every few hours.</span>
                    </>
                  ) :
                  (
                    <>
                      <b className="text-[13.5px] font-semibold">Your chart starts with your first deposit</b>
                      <span className="text-label-sm text-g-500">Add cash to see how your money moves.</span>
                    </>
                  )}
              </div>
            ) :
            (
              <Chart
                // A fresh chart per range, so focus doesn't carry over.
                key={rangeId}
                definition={definition}
                ariaLabel={title === "Total value" ? "Portfolio value" : String(title)}
                height={210}
                className="cursor-crosshair touch-pan-y text-caption-sm text-g-500"
                onFocusChange={(point) => setIndex(point === null ? null : (point.datum as PlotPoint).index)}
                renderTooltipBody={({ points }) => (
                  <TooltipBody format={format} point={points[0]?.datum as PlotPoint | undefined} />
                )}
              />
            )}
        </TabsPanel>
      </Tabs>
    </div>
  )
}
