import { areaY, barY, crosshair, defineChart, dot, group, lineY } from "@tanstack/charts"
import { decorative } from "@tanstack/charts/mark/decorative"
import { Chart } from "@tanstack/charts/react/tooltip"
import { scaleBand } from "@tanstack/charts/scales/band"
import { scaleLinear } from "@tanstack/charts/scales/linear"
import { tooltip } from "@tanstack/charts/tooltip"
import { useMemo, useState } from "react"
import { cn } from "../lib/cn.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"

// Written out in full: Tailwind only emits the theme variables it finds in the source.
const SERIES_COLORS = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
  "var(--color-series-6)",
  "var(--color-series-7)",
  "var(--color-series-8)"
]

export interface ChartSeries {
  readonly key: string
  readonly label: string
  readonly values: ReadonlyArray<number>
  /** A CSS color; defaults to the next `--color-series-*` token. */
  readonly color?: string
}

export interface ChartProps {
  /** One label per point, shown on the x axis and in the tooltip. */
  readonly labels: ReadonlyArray<string>
  readonly series: ReadonlyArray<ChartSeries>
  /** What the chart shows, for screen readers ("Stocks and cash value, last 30 days"). */
  readonly title: string
  readonly height?: number
  /** Formats values in the tooltip. */
  readonly formatValue?: (value: number) => string
  /** Formats the y-axis ticks; keep them short. */
  readonly formatTick?: (value: number) => string
  readonly showLegend?: boolean
  readonly className?: string
}

type ChartKind = "area" | "bar" | "line"

interface Row {
  readonly index: number
  readonly label: string
  readonly key: string
  readonly name: string
  readonly value: number
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
})
const defaultFormatValue = (value: number) => usd.format(value)
const defaultFormatTick = (value: number) => usdCompact.format(value).replace("K", "k")

interface Palette {
  readonly keys: ReadonlyArray<string>
  readonly values: ReadonlyArray<string>
}

interface Options {
  readonly formatTick: (value: number) => string
  readonly animate: boolean
}

/** What every kind shares: the value axis, series colors, area fills, focus by x and the tooltip. */
const shared = (palette: Palette, options: Options) => ({
  y: {
    scale: scaleLinear,
    nice: true,
    grid: { strokeDasharray: "3 4" },
    axis: { line: false, ticks: { size: 0, padding: 6, format: options.formatTick } }
  },
  color: { domain: [...palette.keys], range: [...palette.values] },
  gradients: palette.values.map((color, index) => ({
    id: `chart-fill-${index}`,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [{ offset: 0, color, opacity: 0.22 }, { offset: 1, color, opacity: 0 }]
  })),
  margin: { top: 14, right: 12 },
  focus: "group-x" as const,
  maxFocusDistance: Number.POSITIVE_INFINITY,
  tooltip: { use: tooltip, sticky: false },
  svgAnimation: options.animate
})

/** Bars per label, side by side for each series. */
const barDefinition = (rows: ReadonlyArray<Row>, labels: ReadonlyArray<string>, palette: Palette, options: Options) => {
  const { y, ...rest } = shared(palette, options)
  return defineChart({
    ...rest,
    marks: [
      barY(rows, {
        id: "bars",
        x: "label",
        y: "value",
        color: "key",
        layout: group({ padding: 0.15 }),
        maxThickness: 18,
        radius: { end: 4 }
      })
    ],
    scales: {
      x: {
        scale: () => scaleBand<string>().domain(labels).padding(0.25),
        axis: { line: false, ticks: { size: 0, padding: 10 } }
      },
      y
    }
  })
}

/** Lines over the labels, with a soft fill under each (area) or the latest point marked (line). */
const seriesDefinition = (
  kind: "area" | "line",
  rows: ReadonlyArray<Row>,
  labels: ReadonlyArray<string>,
  palette: Palette,
  options: Options
) => {
  const { y, ...rest } = shared(palette, options)
  const last = rows.filter((row) => row.index === labels.length - 1)

  return defineChart({
    ...rest,
    marks: [
      ...(kind === "area" ?
        palette.keys.map((key, index) =>
          decorative(
            areaY(rows.filter((row) => row.key === key), {
              id: `fill-${key}`,
              x: "index",
              y1: 0,
              y2: "value",
              fill: `url(#chart-fill-${index})`,
              fillOpacity: 1
            })
          )
        ) :
        []),
      lineY(rows, { id: "lines", x: "index", y: "value", z: "key", color: "key", strokeWidth: 2 }),
      ...(kind === "line" ?
        palette.keys.map((key, index) =>
          decorative(dot(last.filter((row) => row.key === key), {
            id: `last-${key}`,
            x: "index",
            y: "value",
            r: 3.5,
            fill: palette.values[index]!,
            stroke: "#fff",
            strokeWidth: 2
          }))
        ) :
        []),
      crosshair({ x: { strokeDasharray: "3 3" }, y: false, marker: true })
    ],
    scales: {
      x: {
        scale: scaleLinear().domain([0, Math.max(labels.length - 1, 1)]),
        axis: {
          line: false,
          ticks: { size: 0, padding: 10, format: (index: number) => labels[Math.round(index)] ?? "" },
          tickLabels: { thin: { minGap: 24, priority: "ends" } }
        }
      },
      y
    }
  })
}

const colorFor = (s: ChartSeries, i: number) => s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]!

function SeriesChart({
  kind,
  labels,
  series,
  title,
  height = 240,
  formatValue = defaultFormatValue,
  formatTick = defaultFormatTick,
  showLegend = true,
  className
}: ChartProps & { readonly kind: ChartKind }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const reduced = useReducedMotion()

  const visible = series.filter((s) => !hidden.has(s.key))

  const definition = useMemo(() => {
    const shown = series.flatMap((s, i) => (hidden.has(s.key) ? [] : [{ s, color: colorFor(s, i) }]))
    const rows = labels.flatMap((label, index) =>
      shown.map(({ s }): Row => ({ index, label, key: s.key, name: s.label, value: s.values[index] ?? 0 }))
    )
    const palette = { keys: shown.map(({ s }) => s.key), values: shown.map(({ color }) => color) }
    const options = { formatTick, animate: !reduced }
    return kind === "bar" ?
      { kind, chart: barDefinition(rows, labels, palette, options) } as const :
      { kind, chart: seriesDefinition(kind, rows, labels, palette, options) } as const
  }, [kind, labels, series, hidden, formatTick, reduced])

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      // Keep at least one series on the chart.
      else if (visible.length > 1) next.add(key)
      return next
    })

  // The same surface for every kind; each kind's definition is typed by its x values (labels or indexes).
  const surface = {
    ariaLabel: title,
    height,
    className: "text-caption text-g-500",
    renderTooltipBody: ({ points }: { readonly points: ReadonlyArray<{ readonly datum: unknown }> }) => {
      const first = points[0]?.datum as Row | undefined
      if (first === undefined) return null
      return (
        <div
          data-slot="chart-tooltip"
          className="grid min-w-[140px] gap-1 rounded-[10px] bg-white px-3 py-2 text-label shadow-e3"
        >
          <b className="font-semibold text-ink">{first.label}</b>
          {points.map((point) => {
            const row = point.datum as Row
            const index = series.findIndex((s) => s.key === row.key)
            return (
              <span key={row.key} className="flex items-center gap-2">
                <i
                  aria-hidden
                  className="size-2 rounded-[2px]"
                  style={{ background: colorFor(series[index]!, index) }}
                />
                <span className="text-g-600">{row.name}</span>
                <b className="ml-auto pl-3 font-semibold text-ink tabular-nums">{formatValue(row.value)}</b>
              </span>
            )
          })}
        </div>
      )
    }
  }

  return (
    <div data-slot="chart-card" className={cn("grid min-w-0 gap-3", className)}>
      {definition.kind === "bar" ?
        <Chart definition={definition.chart} {...surface} /> :
        <Chart definition={definition.chart} {...surface} />}

      {showLegend && (
        <ul aria-label="Series" className="flex flex-wrap justify-center gap-1.5">
          {series.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={!hidden.has(s.key)}
                onClick={() => toggle(s.key)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm text-g-600 transition-colors duration-fast ease-brand hover:bg-g-50 aria-pressed:text-ink aria-[pressed=false]:opacity-50"
              >
                <i aria-hidden className="size-2.5 rounded-[3px]" style={{ background: colorFor(s, i) }} />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Values over time with a soft fill under each line. Hover, or focus and use ← →, to read exact values. */
export function AreaChart(props: ChartProps) {
  return <SeriesChart kind="area" {...props} />
}

/** Amounts per period, side by side for each series. */
export function BarChart(props: ChartProps) {
  return <SeriesChart kind="bar" {...props} />
}

/** Values over time as lines, with the latest point marked. */
export function LineChart(props: ChartProps) {
  return <SeriesChart kind="line" {...props} />
}
