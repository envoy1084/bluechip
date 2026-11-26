import type { Agent, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { cn } from "@bluechip/ui/lib/cn"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { toDollars } from "../../../model/fieldText.ts"
import { standingOf } from "../../../model/usage.ts"
import { StandingPill } from "./StandingPill.tsx"

const LIMIT: Partial<
  Record<PolicyUsage["policy"], { readonly title: string; readonly illustration: IllustrationName }>
> = {
  trade: { title: "Daily budget", illustration: "wallet" },
  tradesPerDay: { title: "Trades today", illustration: "tally" },
  slippageBudget: { title: "Lost to prices", illustration: "receipt" }
}

const BAR = {
  room: "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))]",
  nearly: "bg-[linear-gradient(180deg,#ffd84d,#f5b800)]",
  used: "bg-[linear-gradient(180deg,#ef5a3a,var(--color-loss))]"
} as const

/**
 * One limit as a card: what it counts, how much of it is used, a bar with a tick where the day stands, and what's
 * left or how it counts, pinned to the bottom so a row of cards lines up.
 */
export function LimitCard(
  { agent, counted, resetAt, dayGone }: Readonly<{
    agent: Agent
    counted: PolicyUsage
    resetAt: string
    dayGone: number
  }>
) {
  const dollars = counted.unit === "usd"
  const used = dollars ? toDollars(counted.used) : Number(counted.used)
  const limit = counted.limit === null ? null : dollars ? toDollars(counted.limit) : Number(counted.limit)
  const show = (value: number) => dollars ? formatDollars(value) : value.toLocaleString("en-US")
  const standing = standingOf(counted)
  const share = limit === null || limit === 0 ? null : Math.min(1, used / limit)
  const { illustration, title } = LIMIT[counted.policy] ??
    { title: policyOf(counted.policy).title, illustration: "shield" as const }
  const weekly = counted.policy === "slippageBudget"
  const weeklyBps = configOf(agent.spec.policies, slippageBudget)?.weeklyBps

  const footer = weekly ?
    `Counted over the last 7 days${
      weeklyBps === undefined ? "" : `; it stops at ${formatPercent(weeklyBps)} of your money`
    }.` :
    limit === null ?
    "No limit." :
    standing === "used" ?
    `None left. Starts again at ${resetAt}.` :
    `${show(Math.max(0, limit - used))} left until ${resetAt}.`

  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-lg bg-white p-5 shadow-e2">
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <Illustration name={illustration} size={40} label="" aria-hidden />
          <h4 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h4>
        </span>
        <StandingPill standing={standing} {...(weekly ? { open: "This week" } : {})} />
      </header>

      <div className="flex items-baseline gap-1.5">
        <NumberRoll
          value={used}
          {...(dollars ? { format: (value: number) => formatDollars(value) } : {})}
          className="text-[28px] leading-none font-semibold tracking-[-0.03em]"
        />
        <span className="text-label text-g-500 tabular-nums">{limit === null ? "" : `of ${show(limit)}`}</span>
      </div>

      {share === null || standing === "open" ? null : (
        <div aria-hidden className="relative">
          <div className="h-2 overflow-hidden rounded-full bg-g-100 shadow-[inset_0_1px_1px_rgba(10,11,13,.04)]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-brand motion-reduce:transition-none",
                BAR[standing]
              )}
              style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }}
            />
          </div>
          <i
            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-g-400"
            style={{ left: `${dayGone * 100}%` }}
          />
        </div>
      )}

      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">{footer}</p>
    </section>
  )
}
