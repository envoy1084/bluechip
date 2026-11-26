import type { Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { cn } from "@bluechip/ui/lib/cn"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { toDollars } from "../../model/fieldText.ts"

const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })

/** The next midnight UTC, when the daily counts start again, and the time left until it, ticking each minute. */
function useReset() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  const minutes = Math.max(0, Math.ceil((midnight.getTime() - now) / 60_000))
  const hours = Math.floor(minutes / 60)
  return { at: clock.format(midnight), left: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m` }
}

const LIMIT: Partial<Record<PolicyUsage["policy"], { readonly title: string; readonly icon: IconName }>> = {
  trade: { title: "Daily budget", icon: "wallet" },
  tradesPerDay: { title: "Trades today", icon: "activity" },
  slippageBudget: { title: "Lost to prices", icon: "chart-down" }
}

const STANDING = {
  room: { label: "Room left", tone: "bg-gain-wash text-gain", bar: "bg-blue" },
  nearly: { label: "Nearly used", tone: "bg-warn-wash text-warn", bar: "bg-[#f5b400]" },
  used: { label: "Used up", tone: "bg-g-100 text-g-700", bar: "bg-g-500" }
} as const

/** One limit as a card: what it counts, how much of it is used, a bar, and what's left or how it counts. */
function LimitCard(
  { agent, counted, resetAt }: Readonly<{ agent: Agent; counted: PolicyUsage; resetAt: string }>
) {
  const dollars = counted.unit === "usd"
  const used = dollars ? toDollars(counted.used) : Number(counted.used)
  const limit = counted.limit === null ? null : dollars ? toDollars(counted.limit) : Number(counted.limit)
  const show = (value: number) => dollars ? formatDollars(value) : value.toLocaleString("en-US")
  const share = limit === null || limit === 0 ? null : Math.min(1, used / limit)
  const standing = share === null ? null : share >= 1 ? STANDING.used : share >= 0.8 ? STANDING.nearly : STANDING.room
  const { icon, title } = LIMIT[counted.policy] ?? { title: policyOf(counted.policy).title, icon: "shield" as IconName }
  const weekly = configOf(agent.spec.policies, slippageBudget)?.weeklyBps

  const footer = counted.policy === "slippageBudget" ?
    `Counted over the last 7 days${
      weekly === undefined ? "" : `; it stops at ${formatPercent(weekly)} of your money`
    }.` :
    limit === null ?
    "No limit." :
    share === 1 ?
    `None left. Starts again at ${resetAt}.` :
    `${show(Math.max(0, limit - used))} left until ${resetAt}.`

  return (
    <section aria-label={title} className="grid content-start gap-4 rounded-lg bg-white p-5 shadow-e2">
      <header className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[9px] text-g-600 surface-well">
            <Icon name={icon} size={16} />
          </span>
          <h4 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h4>
        </span>
        {standing === null ?
          null :
          (
            <span
              className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", standing.tone)}
            >
              {standing.label}
            </span>
          )}
      </header>

      <div className="flex items-baseline gap-1.5">
        <NumberRoll
          value={used}
          {...(dollars ? { format: (value: number) => formatDollars(value) } : {})}
          className="text-[28px] leading-none font-semibold tracking-[-0.03em]"
        />
        <span className="text-label text-g-500 tabular-nums">
          {limit === null ? (counted.policy === "slippageBudget" ? "this week" : "") : `of ${show(limit)}`}
        </span>
      </div>

      {share === null ? null : (
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-g-100">
          <div
            className={cn("h-full rounded-full transition-[width] duration-700 ease-brand", standing!.bar)}
            style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%` }}
          />
        </div>
      )}

      <p className="border-t border-g-100 pt-3 text-label-sm text-g-600">{footer}</p>
    </section>
  )
}

/**
 * What a locked agent has used, read from its session onchain: each limit as a card with how much is used and left,
 * and when the daily ones start again (gas is bluechip's to watch).
 */
export function UsageCard(
  { agent, usage }: Readonly<{ agent: Agent; usage: AsyncResult.AsyncResult<AgentUsage, unknown> }>
) {
  const reset = useReset()
  const shown = AsyncResult.isSuccess(usage) ?
    usage.value.policies.filter((counted) =>
      !policyOf(counted.policy).hidden && !(counted.policy === "trade" && counted.limit === BigInt(0))
    ) :
    []

  return (
    <section aria-labelledby={`usage-${agent.id}`} className="grid content-start gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 px-0.5">
        <div className="grid gap-0.5">
          <h3 id={`usage-${agent.id}`} className="text-[16px] font-semibold tracking-[-0.015em]">Today's usage</h3>
          <p className="text-label-sm text-g-500">Read from Base: the counts its policies check before every trade.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-label-sm font-medium text-blue">
          <Icon name="clock" size={13} />
          Resets in {reset.left}, at {reset.at} your time
        </span>
      </div>

      {AsyncResult.isSuccess(usage) ?
        (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((counted) => (
              <LimitCard key={counted.policy} agent={agent} counted={counted} resetAt={reset.at} />
            ))}
          </div>
        ) :
        AsyncResult.isInitial(usage) ?
        (
          <div aria-busy className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["a", "b", "c"].map((key) => <SkeletonBlock key={key} className="h-[186px] w-full rounded-lg" />)}
          </div>
        ) :
        (
          <p className="rounded-lg bg-white p-5 text-body-sm text-g-600 shadow-e2">
            We couldn't read its usage from Base just now. Try again in a moment.
          </p>
        )}
    </section>
  )
}
