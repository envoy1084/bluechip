import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useState
} from "react"
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { cn } from "../lib/cn.ts"
import { useReducedMotion } from "../motion/use-reduced-motion.ts"

/* ---------- Container, tooltip and legend (shadcn's chart pattern) ---------- */

/** Names and colors for each series, by data key. Colors default to the `--color-series-*` tokens, in order. */
export type ChartConfig = Readonly<Record<string, { readonly label?: ReactNode; readonly color?: string }>>

interface ChartContextValue {
  readonly config: ChartConfig
}

const ChartContext = createContext<ChartContextValue | null>(null)

const useChart = (): ChartContextValue => {
  const context = useContext(ChartContext)
  if (!context) throw new Error("Chart parts must be used inside a ChartContainer.")
  return context
}

const seriesToken = (index: number) => `var(--color-series-${(index % 8) + 1})`

/** The CSS variable a series paints with: `fill="var(--chart-stocks)"`. */
export const chartColor = (key: string): string => `var(--chart-${key})`

export interface ChartContainerProps extends ComponentProps<"div"> {
  readonly config: ChartConfig
  /** One Recharts chart (`AreaChart`, `BarChart`, …); it fills the container. */
  readonly children: ReactElement
}

/**
 * Sizes a Recharts chart to its box, gives every series in `config` a `--chart-<key>` color, and styles axes, grid
 * and cursor in the kit's neutrals. Give it a height (`className="h-60"`); it defaults to 240 px.
 */
export function ChartContainer({ config, className, style, children, ...props }: ChartContainerProps) {
  const colors = Object.fromEntries(
    Object.entries(config).map(([key, series], i) => [`--chart-${key}`, series.color ?? seriesToken(i)])
  )
  const context = useMemo(() => ({ config }), [config])
  return (
    <ChartContext value={context}>
      <div
        data-slot="chart"
        style={{ ...colors, ...style } as CSSProperties}
        className={cn(
          "relative h-[240px] w-full min-w-0 text-caption-sm",
          "[&_.recharts-cartesian-axis-tick_text]:fill-g-400 [&_.recharts-text]:tabular-nums",
          "[&_.recharts-cartesian-grid_line]:stroke-g-100 [&_.recharts-reference-line_line]:stroke-g-300",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-g-300 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-g-50",
          // The accessibility layer focuses the chart surface; outline it like every other control.
          "[&_.recharts-surface]:rounded-sm [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:shadow-[0_0_0_2px_var(--color-blue)]",
          "[&_.recharts-wrapper]:outline-none",
          className
        )}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>{children}</ResponsiveContainer>
      </div>
    </ChartContext>
  )
}

export const ChartTooltip = Tooltip

interface ChartPayloadItem {
  readonly dataKey?: unknown
  readonly name?: unknown
  readonly value?: unknown
  readonly color?: string | undefined
}

export interface ChartTooltipContentProps {
  /** Set by Recharts. */
  readonly active?: boolean
  readonly payload?: ReadonlyArray<ChartPayloadItem>
  readonly label?: ReactNode
  readonly accessibilityLayer?: boolean
  /** Formats each value ("$8,620"). */
  readonly valueFormatter?: (value: number) => string
  readonly labelFormatter?: (label: ReactNode) => ReactNode
  readonly hideLabel?: boolean
  readonly className?: string
}

const NO_ITEMS: ReadonlyArray<never> = []
const formatNumber = (value: number) => value.toLocaleString("en-US")

const keyOf = (item: ChartPayloadItem) => String(item.dataKey ?? item.name ?? "")

/** The kit's tooltip: the point's label, then a swatch, name and value per series. Pass as `<ChartTooltip content={…} />`. */
export function ChartTooltipContent(
  {
    active = false,
    payload = NO_ITEMS,
    label,
    accessibilityLayer = false,
    valueFormatter = formatNumber,
    labelFormatter,
    hideLabel = false,
    className
  }: ChartTooltipContentProps
) {
  const { config } = useChart()
  if (!active || payload.length === 0) return null
  return (
    <div
      data-slot="chart-tooltip"
      {
        // Keyboard readers hear each point as the arrow keys move the tooltip.
        ...(accessibilityLayer ? { role: "status", "aria-live": "polite" } : {})
      }
      className={cn(
        "pointer-events-none grid min-w-[150px] gap-1 rounded-md bg-white px-[11px] py-[9px] text-label-sm shadow-e3",
        className
      )}
    >
      {!hideLabel && (
        <strong className="text-caption font-semibold text-g-500">
          {labelFormatter ? labelFormatter(label) : label}
        </strong>
      )}
      {payload.map((item) => {
        const key = keyOf(item)
        return (
          <div key={key} className="flex items-center gap-[7px]">
            <i
              aria-hidden
              className="size-[9px] shrink-0 rounded-[3px]"
              style={{ background: item.color ?? chartColor(key) }}
            />
            <span>{config[key]?.label ?? key}</span>
            <b className="ml-auto pl-3 font-semibold tabular-nums">
              {typeof item.value === "number" ? valueFormatter(item.value) : String(item.value ?? "")}
            </b>
          </div>
        )
      })}
    </div>
  )
}

export const ChartLegend = Legend

export interface ChartLegendContentProps {
  /** Set by Recharts, or pass the series yourself. */
  readonly payload?: ReadonlyArray<{ readonly dataKey?: unknown; readonly value?: unknown }>
  /** Series hidden by the reader. With `onToggle`, each item becomes a button that shows or hides its series. */
  readonly hidden?: ReadonlySet<string>
  readonly onToggle?: (key: string) => void
  readonly className?: string
}

/** A swatch and name per series, from the chart config. */
export function ChartLegendContent({ payload = NO_ITEMS, hidden, onToggle, className }: ChartLegendContentProps) {
  const { config } = useChart()
  return (
    <div data-slot="chart-legend" className={cn("flex flex-wrap gap-1.5", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "")
        const shown = !hidden?.has(key)
        const swatch = (
          <i
            aria-hidden
            className="size-[9px] shrink-0 rounded-[3px] bg-g-200"
            // The config's color, so the legend also works outside the container that defines `--chart-*`.
            style={shown ? { background: config[key]?.color ?? chartColor(key) } : undefined}
          />
        )
        const name = config[key]?.label ?? key
        return onToggle ?
          (
            <button
              key={key}
              type="button"
              aria-pressed={shown}
              onClick={() => onToggle(key)}
              className="inline-flex h-7 cursor-pointer items-center gap-[7px] rounded-[7px] px-2.5 text-label font-medium text-g-700 hover:bg-g-100 focus-visible:outline-offset-0 aria-[pressed=false]:text-g-400 aria-[pressed=false]:line-through"
            >
              {swatch}
              {name}
            </button>
          ) :
          (
            <span key={key} className="inline-flex h-7 items-center gap-[7px] px-2.5 text-label font-medium text-g-700">
              {swatch}
              {name}
            </span>
          )
      })}
    </div>
  )
}

/* ---------- Ready-made charts ---------- */

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

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
})
const defaultFormatValue = (value: number) => usd.format(value)
const defaultFormatTick = (value: number) => usdCompact.format(value).replace("K", "k")

function LastDot(
  { cx, cy, index, last, color }: {
    readonly cx?: number
    readonly cy?: number
    readonly index?: number
    readonly last: number
    readonly color: string
  }
) {
  if (index !== last) return <g />
  return <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />
}

const CHARTS = { area: RechartsAreaChart, bar: RechartsBarChart, line: RechartsLineChart } as const

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
  const gradient = useId().replace(/[^a-zA-Z0-9]/g, "")

  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        series.map((s, i) => [s.key, { label: s.label, color: s.color ?? seriesToken(i) }] as const)
      ),
    [series]
  )
  const legendContext = useMemo(() => ({ config }), [config])
  const data = useMemo(
    () => labels.map((label, i) => ({ label, ...Object.fromEntries(series.map((s) => [s.key, s.values[i] ?? 0])) })),
    [labels, series]
  )
  const visible = series.filter((s) => !hidden.has(s.key))
  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      // Keep at least one series on the chart.
      else if (visible.length > 1) next.add(key)
      return next
    })

  const Chart = CHARTS[kind]
  const animate = !reduced
  return (
    <div data-slot="chart-card" className={cn("grid min-w-0 gap-3", className)}>
      <ChartContainer config={config} style={{ height }}>
        <Chart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 0 }} title={title}>
          {kind === "area" && (
            <defs>
              {visible.map((s) => (
                <linearGradient key={s.key} id={`${gradient}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={chartColor(s.key)} stopOpacity={0.22} />
                  <stop offset="1" stopColor={chartColor(s.key)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
          )}
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
          <YAxis width={52} tickLine={false} axisLine={false} tickMargin={6} tickFormatter={formatTick} />
          <ChartTooltip
            cursor={kind === "bar" ? true : { strokeDasharray: "3 3" }}
            isAnimationActive={false}
            content={<ChartTooltipContent valueFormatter={formatValue} />}
          />
          {visible.map((s) => {
            const color = chartColor(s.key)
            if (kind === "bar") {
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={animate}
                />
              )
            }
            const activeDot = { r: 4, fill: color, stroke: "#fff", strokeWidth: 2 }
            return kind === "area" ?
              (
                <Area
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradient}-${s.key})`}
                  activeDot={activeDot}
                  isAnimationActive={animate}
                />
              ) :
              (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  type="monotone"
                  stroke={color}
                  strokeWidth={2}
                  // Only the latest point gets a dot; Recharts clones the element for each point.
                  dot={<LastDot last={labels.length - 1} color={color} />}
                  activeDot={activeDot}
                  isAnimationActive={animate}
                />
              )
          })}
        </Chart>
      </ChartContainer>
      {showLegend && (
        <ChartContext value={legendContext}>
          <ChartLegendContent
            payload={series.map((s) => ({ dataKey: s.key }))}
            hidden={hidden}
            onToggle={toggle}
          />
        </ChartContext>
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
