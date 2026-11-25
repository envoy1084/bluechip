import type { ComponentProps } from "react"
import { Button } from "../components/button.tsx"
import { Icon } from "../icons/icon.tsx"
import { type AgentLimits, limitRules } from "../lib/agent-limits.ts"
import { cn } from "../lib/cn.ts"
import { UsageMeter } from "./usage-meter.tsx"

export interface PermissionCardProps extends Omit<ComponentProps<"div">, "children"> {
  readonly limits: AgentLimits
  /** Dollars spent today. Without it, or for an agent that never buys, the usage meter is hidden. */
  readonly spentToday?: number
  /** When the daily spend starts again, for the usage meter: "midnight UTC". */
  readonly resetsAt?: string
  /** The day the Face ID lock runs out: "21 Feb". Without it the card is a draft, not locked yet. */
  readonly lockedUntil?: string
  /** The agent was removed: its limits no longer apply, so the card says so instead of when they're locked until. */
  readonly removed?: boolean
  /** `full` puts the rules in two columns when there is room; `compact` always stacks them. */
  readonly size?: "full" | "compact"
  /** Shows an "Edit limits" button in the footer. */
  readonly onEditLimits?: () => void
}

function RuleList({ title, rules, kind }: {
  readonly title: string
  readonly rules: ReadonlyArray<string>
  readonly kind: "can" | "never"
}) {
  return (
    <div data-slot={`permission-card-${kind}`} className="grid content-start gap-2.5 px-[18px] py-4">
      <h4 className="text-label-sm font-semibold text-g-500">{title}</h4>
      <ul className="grid gap-2">
        {rules.map((rule) => (
          <li key={rule} className="grid grid-cols-[18px_1fr] gap-1.5 text-[13.5px] leading-[1.45] text-g-800">
            <Icon
              name={kind === "can" ? "check" : "close"}
              size={14}
              className={cn("mt-0.5", kind === "can" ? "text-gain" : "text-loss")}
            />
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The promise, in two columns: everything an agent may do, everything it never can, how much it has used today,
 * and when the Face ID lock runs out. Rules are sentences, not settings.
 */
export function PermissionCard(
  { limits, spentToday, resetsAt, lockedUntil, removed = false, size = "full", onEditLimits, className, ...props }:
    PermissionCardProps
) {
  const { can, never } = limitRules(limits)
  const locked = lockedUntil !== undefined
  return (
    <div
      data-slot="permission-card"
      data-size={size}
      data-locked={locked || undefined}
      className={cn(
        "@container w-full overflow-hidden rounded-lg bg-white shadow-e2",
        !locked &&
          "bg-[repeating-linear-gradient(135deg,#fff_0_10px,#fbfbfc_10px_20px)] shadow-[0_0_0_1px_rgba(10,11,13,.1)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "grid divide-y divide-g-100",
          size === "full" && "@[520px]:grid-cols-2 @[520px]:divide-x @[520px]:divide-y-0",
          size === "compact" && "[&_li]:text-label-sm [&>div]:px-3.5 [&>div]:py-3"
        )}
      >
        <RuleList title="It can" rules={can} kind="can" />
        <RuleList title="It can never" rules={never} kind="never" />
      </div>
      {spentToday !== undefined && limits.dailySpend > 0 && (
        <div className="border-t border-g-100 px-[18px] py-3.5">
          <UsageMeter used={spentToday} limit={limits.dailySpend} {...(resetsAt === undefined ? {} : { resetsAt })} />
        </div>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2.5 border-t border-g-100 py-[11px] pr-3.5 pl-[18px]",
          locked && "bg-[#fafafb]"
        )}
      >
        <span className="inline-flex items-center gap-1.5 text-label-sm text-g-500">
          <Icon name="lock" size={14} />
          {removed ?
            "Removed, so these limits no longer apply" :
            locked ?
            `Locked with Face ID until ${lockedUntil}` :
            "Not locked yet"}
        </span>
        {onEditLimits && (
          <Button variant="secondary" size="sm" onClick={onEditLimits}>
            <Icon name="edit" size={14} />Edit limits
          </Button>
        )}
      </div>
    </div>
  )
}
