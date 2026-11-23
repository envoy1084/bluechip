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

export interface UsageMeterProps extends Omit<ComponentProps<"div">, "children"> {
  /** Dollars used so far. */
  readonly used: number
  /** The limit in dollars. */
  readonly limit: number
  /** What is measured. Defaults to "Spent today". */
  readonly label?: string
  /** When the limit resets, said when it's reached. */
  readonly resetsAt?: string
}

/** How much of today's spending limit an agent has used, with what's left and when it resets. Amounts roll. */
export function UsageMeter(
  { used, limit, label = "Spent today", resetsAt = "midnight New York time", className, ...props }: UsageMeterProps
) {
  const level = usageLevel(used, limit)
  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 100
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
      <div
        // A native <meter> can't take the kit's gradient fill in every browser, so a div carries the meter role.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={summary}
        className="h-2 overflow-hidden rounded-[4px] bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.04)]"
      >
        <div
          className={cn(
            "h-full rounded-[4px] shadow-[inset_0_1px_0_rgba(255,255,255,.35)] transition-[width] duration-slow ease-brand",
            FILL[level]
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
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
