import { type ComponentProps, useId } from "react"
import { cn } from "../lib/cn.ts"

/** A sparkline's color: Gain, Loss, grey, or Base Blue for a series with no direction (your total value). */
export type SparklineTone = "up" | "down" | "flat" | "brand"

const TONE: Readonly<Record<SparklineTone, string>> = {
  up: "text-gain",
  down: "text-loss",
  flat: "text-g-400",
  brand: "text-blue"
}

const LABEL: Readonly<Record<SparklineTone, string>> = {
  up: "Trending up",
  down: "Trending down",
  flat: "Flat",
  brand: "Trend"
}

/** Up or down when the last value is more than 0.05% away from the first, otherwise flat. */
export const sparklineTone = (values: ReadonlyArray<number>): SparklineTone => {
  const first = values[0] ?? 0, last = values.at(-1) ?? 0
  return last > first * 1.0005 ? "up" : last < first * 0.9995 ? "down" : "flat"
}

export interface SparklineProps extends Omit<ComponentProps<"svg">, "children" | "values"> {
  readonly values: ReadonlyArray<number>
  readonly width?: number
  readonly height?: number
  /** Defaults to the direction of the series. */
  readonly tone?: SparklineTone
  /** A 16% fill under the line. */
  readonly area?: boolean
  /** A dot on the latest value. Defaults to true. */
  readonly dot?: boolean
  /**
   * The index the market closed at. The line after it is dashed: those prices are the last close, not live.
   */
  readonly closedFrom?: number
  /** Accessible name. Defaults to the trend, and says when the market is closed. */
  readonly label?: string
}

const path = (points: ReadonlyArray<readonly [number, number]>): string =>
  points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")

/** A day's shape in a glance: 1.6 px line, round joins, a dot on the latest price. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone,
  area = false,
  dot = true,
  closedFrom,
  label,
  className,
  ...props
}: SparklineProps) {
  const gradient = useId()
  const resolved = tone ?? sparklineTone(values)
  const min = Math.min(...values), span = Math.max(...values) - min || 1
  const pad = dot ? 3.5 : 1
  const points = values.map((value, i) =>
    [
      pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2),
      pad + (1 - (value - min) / span) * (height - pad * 2)
    ] as const
  )
  const solid = closedFrom === undefined ? points : points.slice(0, closedFrom + 1)
  const dashed = closedFrom === undefined ? [] : points.slice(closedFrom)
  const first = points[0], end = points.at(-1)
  return (
    <svg
      data-slot="sparkline"
      data-tone={resolved}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? `${LABEL[resolved]}${closedFrom === undefined ? "" : ", market closed"}`}
      className={cn("block shrink-0 overflow-visible", TONE[resolved], className)}
      {...props}
    >
      {area && first && end && (
        <>
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".16" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${path(points)} L${end[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height}Z`}
            fill={`url(#${gradient})`}
          />
        </>
      )}
      <path
        d={path(solid)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {dashed.length > 1 && (
        <path
          d={path(dashed)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="2 3"
          strokeLinecap="round"
          opacity=".55"
        />
      )}
      {dot && end && <circle cx={end[0]} cy={end[1]} r="2.6" fill="currentColor" stroke="#fff" strokeWidth="1.5" />}
    </svg>
  )
}
