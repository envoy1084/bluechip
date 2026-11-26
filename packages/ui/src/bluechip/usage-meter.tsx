import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { formatDollars } from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"
import { NumberRoll } from "../motion/number-roll.tsx"

/** How much of the limit is used: amber from 80%, red when it's all used. */
export type UsageLevel = "normal" | "near" | "full"

/** The meter's level for an amount used against a limit. */
export const usageLevel = (used: number, limit: number): UsageLevel => {
  const fraction = limit > 0 ? used / limit : 1
  if (fraction >= 1) return "full"
  return fraction >= 0.8 ? "near" : "normal"
}

const FILL: Readonly<Record<UsageLevel, string>> = {
  normal: "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))]",
  near: "bg-[linear-gradient(180deg,#ffd84d,#f5b800)]",
  full: "bg-[linear-gradient(180deg,#ef5a3a,var(--color-loss))]"
}

export interface UsageBarProps extends Omit<ComponentProps<"div">, "children"> {
  /** How much is used, in any unit. */
  readonly used: number
  /** The limit, in the same unit. */
  readonly limit: number
  /** The meter's name for screen readers; without one the bar is decoration beside words that say the same. */
  readonly label?: string
  /** What the meter reads aloud: "$140 of $200". */
  readonly valueText?: string
  /** How much of the day has gone, 0 to 1: a tick on the bar, so you can tell spending ahead of the day. */
  readonly dayGone?: number
}

/**
 * The bar of a usage meter on its own, for compact places (a list card, a limit's card): blue, amber from 80%, red
 * when it's all used, with an optional tick where the day stands.
 */
export function UsageBar({ used, limit, label, valueText, dayGone, className, ...props }: UsageBarProps) {
  const level = usageLevel(used, limit)
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100
  const meter = label === undefined ?
    { "aria-hidden": true } :
    {
      role: "meter",
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": limit,
      "aria-valuenow": Math.min(used, limit),
      ...(valueText === undefined ? {} : { "aria-valuetext": valueText })
    }

  return (
    <div data-slot="usage-bar" data-level={level} className={cn("relative h-2", className)} {...props}>
      <div
        {
          // A native <meter> can't take the kit's gradient fill in every browser, so a div carries the meter role.
          ...meter
        }
        className="h-full overflow-hidden rounded-full bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.04)]"
      >
        <div
          className={cn(
            "h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,.35)] transition-[width] duration-slow ease-brand motion-reduce:transition-none",
            FILL[level]
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {dayGone === undefined ? null : (
        <i
          aria-hidden
          data-slot="usage-bar-day"
          className="absolute -top-1 h-[calc(100%+8px)] w-0.5 -translate-x-1/2 rounded-full bg-g-400"
          style={{ left: `${Math.min(1, Math.max(0, dayGone)) * 100}%` }}
        />
      )}
    </div>
  )
}

export interface UsageMeterProps extends Omit<ComponentProps<"div">, "children"> {
  /** Dollars used so far. */
  readonly used: number
  /** The limit in dollars. */
  readonly limit: number
  /** What is measured. Defaults to "Spent today". */
  readonly label?: string
  /** When the limit resets, said when it's reached. */
  readonly resetsAt?: string
  /** How much of the day has gone, 0 to 1, as a tick on the bar. */
  readonly dayGone?: number
}

/** How much of today's spending limit an agent has used, with what's left and when it resets. Amounts roll. */
export function UsageMeter(
  { used, limit, label = "Spent today", resetsAt = "midnight UTC", dayGone, className, ...props }: UsageMeterProps
) {
  const level = usageLevel(used, limit)
  const summary = `${formatDollars(used)} of ${formatDollars(limit)}`
  return (
    <div data-slot="usage-meter" data-level={level} className={cn("grid w-full gap-[7px]", className)} {...props}>
      <div className="flex justify-between gap-2.5 text-[13.5px] text-g-600">
        <span>{label}</span>
        <span className="tabular-nums">
          <NumberRoll value={used} format={formatDollars} className="font-semibold text-ink" /> of{" "}
          {formatDollars(limit)}
        </span>
      </div>
      <UsageBar
        used={used}
        limit={limit}
        label={label}
        valueText={summary}
        {...(dayGone === undefined ? {} : { dayGone })}
      />
      <span
        data-slot="usage-meter-note"
        className={cn(
          "inline-flex items-center gap-[5px] text-caption text-g-500",
          level === "near" && "text-warn",
          level === "full" && "font-[550] text-loss"
        )}
      >
        {level === "near" && <Icon name="warning" size={13} />}
        {level === "full" && <Icon name="stop-sign" size={13} />}
        {level === "full" ?
          `Limit reached. Resets at ${resetsAt}.` :
          (
            <>
              <NumberRoll value={limit - used} format={formatDollars} /> left today
            </>
          )}
      </span>
    </div>
  )
}
