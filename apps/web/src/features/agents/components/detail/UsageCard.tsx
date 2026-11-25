import type { Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Progress } from "@bluechip/ui/components/progress"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useId } from "react"
import { toDollars } from "../../model/fieldText.ts"

function Count({ label, counted }: Readonly<{ label: string; counted: PolicyUsage }>) {
  const id = useId()
  const used = Number(counted.used)
  const limit = counted.limit === null ? null : Number(counted.limit)
  const left = limit === null ? null : Math.max(0, limit - used)

  return (
    <div className="grid gap-[7px]">
      <div className="flex justify-between gap-2.5 text-[13.5px] text-g-600">
        <span id={id}>{label}</span>
        <span className="tabular-nums">
          <b className="font-semibold text-ink">{used}</b>
          {limit === null ? null : ` of ${limit}`}
        </span>
      </div>
      {limit === null ? null : (
        <>
          <Progress
            aria-labelledby={id}
            value={Math.min(used, limit)}
            max={limit}
            variant={left === 0 ? "warning" : "default"}
          />
          <span className="text-caption text-g-500">
            {left === 0 ? "None left today. They reset at midnight UTC." : `${left} left today`}
          </span>
        </>
      )}
    </div>
  )
}

function Amount({ label, counted, note }: Readonly<{ label: string; counted: PolicyUsage; note?: string }>) {
  return (
    <div className="grid gap-0.5">
      <div className="flex justify-between gap-2.5 text-[13.5px] text-g-600">
        <span>{label}</span>
        <b className="font-semibold text-ink tabular-nums">
          {formatDollars(toDollars(counted.used))}
          {counted.limit === null
            ? null
            : <span className="font-normal text-g-600">of {formatDollars(toDollars(counted.limit))}</span>}
        </b>
      </div>
      {note === undefined ? null : <span className="text-caption text-g-500">{note}</span>}
    </div>
  )
}

/** One policy's count, in the way its unit reads: dollars against a budget, trades against a cap. */
function PolicyMeter({ agent, counted }: Readonly<{ agent: Agent; counted: PolicyUsage }>) {
  if (counted.policy === "trade") {
    if (counted.limit === null || counted.limit === BigInt(0)) return null
    return <UsageMeter used={toDollars(counted.used)} limit={toDollars(counted.limit)} resetsAt="midnight UTC" />
  }
  if (counted.policy === "tradesPerDay") return <Count label="Trades today" counted={counted} />
  if (counted.policy === "slippageBudget") {
    const weekly = configOf(agent.spec.policies, slippageBudget)?.weeklyBps
    return (
      <Amount
        label="Lost to prices this week"
        counted={counted}
        {...(weekly === undefined ? {} : { note: `It stops at ${formatPercent(weekly)} of your money in any 7 days.` })}
      />
    )
  }

  const title = policyOf(counted.policy).title
  return counted.unit === "usd" ? <Amount label={title} counted={counted} /> : <Count label={title} counted={counted} />
}

/** What a locked agent has used, read from its session onchain, policy by policy (gas is bluechip's to watch). */
export function UsageCard(
  { agent, usage }: Readonly<{ agent: Agent; usage: AsyncResult.AsyncResult<AgentUsage, unknown> }>
) {
  return (
    <section aria-labelledby={`usage-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`usage-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">Usage</h3>
      <div className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
        {AsyncResult.isSuccess(usage) ?
          usage.value.policies
            .filter((counted) => !policyOf(counted.policy).hidden)
            .map((counted) => <PolicyMeter key={counted.policy} agent={agent} counted={counted} />) :
          AsyncResult.isInitial(usage) ?
          (
            <div aria-busy className="grid gap-3">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
            </div>
          ) :
          (
            <p className="text-body-sm text-g-600">
              We couldn't read its usage from Base just now. Try again in a moment.
            </p>
          )}
      </div>
    </section>
  )
}
