import type { Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { UsageRing } from "@bluechip/ui/bluechip/usage-ring"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { toDollars } from "../../model/fieldText.ts"

const dollars = (value: number) => formatDollars(value)

/** Time left until the next UTC midnight, when the daily counts start again, ticking each minute. */
function ResetsIn() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(tick)
  }, [])
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  const minutes = Math.max(0, Math.ceil((midnight.getTime() - now) / 60_000))
  const hours = Math.floor(minutes / 60)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-label-sm font-medium text-blue">
      <Icon name="clock" size={13} />
      Resets in {hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}, at midnight UTC
    </span>
  )
}

/** One policy's count as a ring: dollars against a budget, trades against a cap, prices lost against a weekly cap. */
function PolicyRing({ agent, counted }: Readonly<{ agent: Agent; counted: PolicyUsage }>) {
  const used = counted.unit === "usd" ? toDollars(counted.used) : Number(counted.used)
  const limit = counted.limit === null
    ? null
    : counted.unit === "usd"
    ? toDollars(counted.limit)
    : Number(counted.limit)
  const format = counted.unit === "usd" ? dollars : undefined
  const left = limit === null ? null : Math.max(0, limit - used)
  const leftText = left === null ?
    undefined :
    left === 0 ?
    "None left" :
    `${counted.unit === "usd" ? dollars(left) : left} left`

  if (counted.policy === "trade") {
    if (limit === null || limit === 0) return null
    return <UsageRing label="Spent today" used={used} limit={limit} format={dollars} detail={leftText} />
  }
  if (counted.policy === "tradesPerDay") {
    return (
      <UsageRing
        label="Trades today"
        used={used}
        limit={limit}
        {...(leftText === undefined ? {} : { detail: leftText })}
      />
    )
  }
  if (counted.policy === "slippageBudget") {
    const weekly = configOf(agent.spec.policies, slippageBudget)?.weeklyBps
    return (
      <UsageRing
        label="Lost to prices"
        used={used}
        limit={limit}
        format={dollars}
        detail={weekly === undefined ? "This week" : `This week, it stops at ${formatPercent(weekly)}`}
      />
    )
  }
  return (
    <UsageRing
      label={policyOf(counted.policy).title}
      used={used}
      limit={limit}
      {...(format === undefined ? {} : { format })}
      {...(leftText === undefined ? {} : { detail: leftText })}
    />
  )
}

/**
 * What a locked agent has used, read from its session onchain: each limit as a ring, with when the daily ones start
 * again (gas is bluechip's to watch).
 */
export function UsageCard(
  { agent, usage }: Readonly<{ agent: Agent; usage: AsyncResult.AsyncResult<AgentUsage, unknown> }>
) {
  const shown = AsyncResult.isSuccess(usage) ?
    usage.value.policies.filter((counted) => !policyOf(counted.policy).hidden) :
    []

  return (
    <section aria-labelledby={`usage-${agent.id}`} className="grid content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
        <h3 id={`usage-${agent.id}`} className="text-[15px] font-semibold tracking-[-0.01em]">Today's usage</h3>
        <ResetsIn />
      </div>
      <div className="rounded-lg bg-white px-[18px] py-6 shadow-e2">
        {AsyncResult.isSuccess(usage) ?
          (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6">
              {shown.map((counted) => <PolicyRing key={counted.policy} agent={agent} counted={counted} />)}
            </div>
          ) :
          AsyncResult.isInitial(usage) ?
          (
            <div aria-busy className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6">
              {["a", "b", "c"].map((key) => (
                <div key={key} className="grid justify-items-center gap-2.5">
                  <SkeletonBlock className="size-[132px] rounded-full" />
                  <SkeletonBlock className="h-3.5 w-24" />
                </div>
              ))}
            </div>
          ) :
          (
            <p className="text-body-sm text-g-600">
              We couldn't read its usage from Base just now. Try again in a moment.
            </p>
          )}
      </div>
      <p className="px-0.5 text-label-sm text-g-500">
        Read from Base: these are the counts its policies check before every trade.
      </p>
    </section>
  )
}
