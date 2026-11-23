import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react"
import { cn } from "../lib/cn.ts"

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
  /** Formats values in the tooltip and for screen readers. */
  readonly formatValue?: (value: number) => string
  /** Formats the y-axis ticks; keep them short. */
  readonly formatTick?: (value: number) => string
  readonly showLegend?: boolean
  readonly className?: string
}

type ChartKind = "area" | "bar" | "line"

const PAD = { left: 52, right: 12, top: 14, bottom: 28 } as const

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1
})
const defaultFormatValue = (value: number) => usd.format(value)
const defaultFormatTick = (value: number) => usdCompact.format(value).replace("K", "k")

/** Rounds the axis top up to a "nice" number so the four gridlines land on round values. */
const niceMax = (value: number) => {
  const raw = value / 4
  const power = 10 ** Math.floor(Math.log10(raw))
  const n = raw / power
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 5 ? 5 : 10
  return step * power * 4
}

// Series paint with `currentColor` from these classes (spelled out so Tailwind emits the tokens).
const SERIES_TEXT = [
  "text-series-1",
  "text-series-2",
  "text-series-3",
  "text-series-4",
  "text-series-5",
  "text-series-6",
  "text-series-7",
  "text-series-8"
] as const

/** Color props for a series: its own `color`, or the next series token. */
const seriesColor = (series: ChartSeries, index: number) =>
  series.color === undefined ?
    { className: SERIES_TEXT[index % SERIES_TEXT.length] } :
    { style: { color: series.color } }

/** A smooth path through the points (horizontal tangents, like a monotone curve on even spacing). */
const curve = (points: ReadonlyArray<readonly [number, number]>) =>
  points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`
      const [px, py] = points[i - 1]!
      const cx = (px + x) / 2
      return `C${cx},${py} ${cx},${y} ${x},${y}`
    })
    .join("")

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function Chart({
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
  const [plotRef, width] = useWidth()
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [active, setActive] = useState<number | null>(null)
  const id = useId().replace(/[^a-zA-Z0-9]/g, "")

  const colored = series.map((s, i) => ({ ...s, color: seriesColor(s, i) }))
  const visible = colored.filter((s) => !hidden.has(s.key))
  const count = labels.length
  const innerWidth = width - PAD.left - PAD.right
  const innerHeight = height - PAD.top - PAD.bottom
  const max = niceMax(Math.max(1, ...visible.flatMap((s) => s.values)) * 1.04)
  const slot = innerWidth / count
  const x = (i: number) => PAD.left + (kind === "bar" ? slot * (i + 0.5) : (innerWidth / Math.max(1, count - 1)) * i)
  const y = (value: number) => PAD.top + innerHeight - (value / max) * innerHeight
  const base = PAD.top + innerHeight
  const labelEvery = kind === "bar" && width > 480 ? 1 : Math.ceil(count / (width < 480 ? 4 : 7))

  const indexAt = (px: number) => {
    const i = kind === "bar" ?
      Math.floor((px - PAD.left) / slot) :
      Math.round(((px - PAD.left) / innerWidth) * (count - 1))
    return Math.min(count - 1, Math.max(0, i))
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) =>
    setActive(indexAt(event.clientX - event.currentTarget.getBoundingClientRect().left))
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1
    const from = active ?? last
    const next = {
      ArrowRight: Math.min(last, active === null ? last : from + 1),
      ArrowLeft: Math.max(0, active === null ? last : from - 1),
      Home: 0,
      End: last
    }[event.key]
    if (next !== undefined) {
      event.preventDefault()
      setActive(next)
    } else if (event.key === "Escape") {
      setActive(null)
    }
  }

  const point = active === null || visible.length === 0 ? null : active
  const pointText = point === null ?
    "" :
    `${labels[point]}: ${visible.map((s) => `${s.label} ${formatValue(s.values[point] ?? 0)}`).join(", ")}`
  const barWidth = Math.min(18, (slot - 10) / Math.max(1, visible.length))

  return (
    <div data-slot="chart" className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3", className)}>
      {/* A keyboard widget of its own: the arrow keys read the chart point by point. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={plotRef}
        role="application"
        aria-roledescription="chart"
        aria-label={title}
        aria-describedby={`${id}-hint`}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
        className="relative touch-pan-y rounded-sm outline-none focus-visible:shadow-[0_0_0_2px_var(--color-blue)]"
        style={{ height }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
          className="absolute top-0 left-0 block overflow-visible"
        >
          <defs>
            {colored.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1" {...s.color}>
                <stop offset="0" stopColor="currentColor" stopOpacity={0.22} />
                <stop offset="1" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {[0, 1, 2, 3, 4].map((step) => {
            const value = (max / 4) * step
            return (
              <g key={step}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  className={step === 0 ? "stroke-g-200" : "stroke-g-100 [stroke-dasharray:3_4]"}
                />
                <text
                  x={PAD.left - 10}
                  y={y(value) + 4}
                  textAnchor="end"
                  className="fill-g-400 text-[11px] tabular-nums"
                >
                  {formatTick(value)}
                </text>
              </g>
            )
          })}
          {labels.map((label, i) =>
            i % labelEvery === 0 && (
              <text key={label} x={x(i)} y={height - 8} textAnchor="middle" className="fill-g-400 text-[11px]">
                {label}
              </text>
            )
          )}
          {kind === "bar" ?
            visible.map((s, si) =>
              s.values.map((value, i) => {
                const left = x(i) - (barWidth * visible.length) / 2 + si * barWidth + 1
                const top = y(value)
                const h = base - top
                const r = Math.max(0, Math.min(4, h, (barWidth - 2) / 2))
                return (
                  <path
                    key={`${s.key}-${labels[i]}`}
                    {...s.color}
                    fill="currentColor"
                    d={`M${left},${base}V${top + r}q0,-${r} ${r},-${r}h${
                      barWidth - 2 - 2 * r
                    }q${r},0 ${r},${r}V${base}Z`}
                  />
                )
              })
            ) :
            visible.map((s) => {
              const points = s.values.map((value, i) => [x(i), y(value)] as const)
              const line = curve(points)
              const lastPoint = points.at(-1)
              return (
                <g key={s.key} {...s.color}>
                  {kind === "area" && (
                    <path d={`${line}L${x(count - 1)},${base}L${x(0)},${base}Z`} fill={`url(#${id}-${s.key})`} />
                  )}
                  <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  {kind === "line" && lastPoint && (
                    <circle
                      cx={lastPoint[0]}
                      cy={lastPoint[1]}
                      r={3.5}
                      fill="currentColor"
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </g>
              )
            })}
          {point !== null && (
            <g data-slot="chart-cursor">
              <line
                x1={x(point)}
                x2={x(point)}
                y1={PAD.top}
                y2={base}
                className="stroke-g-300 [stroke-dasharray:3_3]"
              />
              {kind !== "bar" && visible.map((s) => (
                <circle
                  key={s.key}
                  cx={x(point)}
                  cy={y(s.values[point] ?? 0)}
                  r={4}
                  fill="currentColor"
                  stroke="#fff"
                  strokeWidth={2}
                  className={cn("drop-shadow-[0_1px_2px_rgba(10,11,13,.25)]", s.color.className)}
                  style={s.color.style}
                />
              ))}
            </g>
          )}
        </svg>
        {point !== null && (
          <div
            data-slot="chart-tooltip"
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-10 grid min-w-[150px] gap-1 rounded-md bg-white px-[11px] py-[9px] text-label-sm shadow-e3",
              x(point) > width / 2 ? "-translate-x-[calc(100%+14px)]" : "translate-x-3.5"
            )}
            style={{ left: x(point), top: PAD.top + 4 }}
          >
            <strong className="text-caption font-semibold text-g-500">{labels[point]}</strong>
            {visible.map((s) => (
              <div key={s.key} className="flex items-center gap-[7px]">
                <i
                  className={cn("size-[9px] shrink-0 rounded-[3px] bg-current", s.color.className)}
                  style={s.color.style}
                />
                <span>{s.label}</span>
                <b className="ml-auto pl-3 font-semibold tabular-nums">{formatValue(s.values[point] ?? 0)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <p id={`${id}-hint`} className="sr-only">Use the left and right arrow keys to read each point.</p>
      <p aria-live="polite" className="sr-only">{pointText}</p>
      {showLegend && (
        <div data-slot="chart-legend" className="flex flex-wrap gap-1.5">
          {colored.map((s) => {
            const shown = !hidden.has(s.key)
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={shown}
                onClick={() =>
                  setHidden((current) => {
                    const next = new Set(current)
                    if (shown && visible.length > 1) next.add(s.key)
                    else next.delete(s.key)
                    return next
                  })}
                className="inline-flex h-7 cursor-pointer items-center gap-[7px] rounded-[7px] px-2.5 text-label font-medium text-g-700 hover:bg-g-100 focus-visible:outline-offset-0 aria-[pressed=false]:text-g-400 aria-[pressed=false]:line-through"
              >
                <i
                  className={cn(
                    "size-[9px] shrink-0 rounded-[3px] bg-current",
                    shown ? s.color.className : "text-g-200"
                  )}
                  style={shown ? s.color.style : undefined}
                />
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Values over time with a soft fill under each line. Hover or use the arrow keys to read exact values. */
export function AreaChart(props: ChartProps) {
  return <Chart kind="area" {...props} />
}

/** Amounts per period, side by side for each series. */
export function BarChart(props: ChartProps) {
  return <Chart kind="bar" {...props} />
}

/** Values over time as lines, with the latest point marked. */
export function LineChart(props: ChartProps) {
  return <Chart kind="line" {...props} />
}
