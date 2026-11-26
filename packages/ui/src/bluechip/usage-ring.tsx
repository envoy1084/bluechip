import type { ComponentProps, ReactNode } from "react"
import { cn } from "../lib/cn.ts"
import { NumberRoll } from "../motion/number-roll.tsx"

export interface UsageRingProps extends Omit<ComponentProps<"figure">, "children"> {
  /** What it counts: "Spent today", "Trades today". */
  readonly label: string
  readonly used: number
  /** The limit; `null` counts with no cap and draws an empty ring. */
  readonly limit: number | null
  /** How a number reads: dollars or a plain count. */
  readonly format?: Intl.NumberFormatOptions | ((value: number) => string)
  /** One line under it: what's left, when it resets. */
  readonly detail?: ReactNode
}

const SIZE = 132
const STROKE = 11
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * One limit as a ring that fills as it's used, with the amount rolling in its middle: blue while there's room, amber
 * from 80%, red when it's used up. The ring's fill animates with each change, and stays put under reduced motion.
 */
export function UsageRing({ label, used, limit, format, detail, className, ...props }: UsageRingProps) {
  const share = limit === null || limit === 0 ? 0 : Math.min(1, used / limit)
  const tone = share >= 1 ? "text-loss" : share >= 0.8 ? "text-warn" : "text-blue"
  const text = (value: number) =>
    typeof format === "function" ? format(value) : new Intl.NumberFormat("en-US", format).format(value)

  return (
    <figure
      data-slot="usage-ring"
      className={cn("grid justify-items-center gap-2.5 text-center", className)}
      {...props}
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={limit === null ? `${label}: ${text(used)}` : `${label}: ${text(used)} of ${text(limit)}`}
          className="-rotate-90"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-g-100" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - share)}
            className={cn(
              tone,
              "transition-[stroke-dashoffset] duration-700 ease-brand motion-reduce:transition-none",
              share === 0 && "opacity-0"
            )}
          />
        </svg>
        <div aria-hidden className="absolute inset-0 grid place-content-center gap-0.5">
          <NumberRoll
            value={used}
            {...(format === undefined ? {} : { format })}
            className="text-[22px] leading-none font-semibold tracking-[-0.03em]"
          />
          {limit === null ? null : <span className="text-caption text-g-500 tabular-nums">of {text(limit)}</span>}
        </div>
      </div>
      <figcaption className="grid gap-0.5">
        <b className="text-[13.5px] font-semibold">{label}</b>
        {detail === undefined ? null : <span className="text-label-sm text-g-500">{detail}</span>}
      </figcaption>
    </figure>
  )
}
