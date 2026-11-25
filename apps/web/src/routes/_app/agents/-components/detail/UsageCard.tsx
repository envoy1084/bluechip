import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { UsageMeter } from "@bluechip/ui/bluechip/usage-meter"
import { Progress } from "@bluechip/ui/components/progress"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import * as AsyncResult from "effect/reactivity/AsyncResult"

const dollars = (amount: bigint) => Number(amount) / 1_000_000

function Trades({ agent, usage }: Readonly<{ agent: Agent; usage: AgentUsage }>) {
  const limit = agent.limits.tradesPerDay
  const left = Math.max(0, limit - usage.tradesToday)

  return (
    <div className="grid gap-[7px]">
      <div className="flex justify-between gap-2.5 text-[13.5px] text-g-600">
        <span id={`trades-${agent.id}`}>Trades today</span>
        <span className="tabular-nums">
          <b className="font-semibold text-ink">{usage.tradesToday}</b> of {limit}
        </span>
      </div>
      <Progress
        aria-labelledby={`trades-${agent.id}`}
        value={Math.min(usage.tradesToday, limit)}
        max={limit}
        variant={left === 0 ? "warning" : "default"}
      />
      <span className="text-caption text-g-500">
        {left === 0 ? "No trades left today. They reset at midnight UTC." : `${left} left today`}
      </span>
    </div>
  )
}

function Slippage({ agent, usage }: Readonly<{ agent: Agent; usage: AgentUsage }>) {
  return (
    <div className="grid gap-0.5">
      <div className="flex justify-between gap-2.5 text-[13.5px] text-g-600">
        <span>Lost to prices this week</span>
        <b className="font-semibold text-ink tabular-nums">{formatDollars(dollars(usage.slippageThisWeek))}</b>
      </div>
      <span className="text-caption text-g-500">
        It stops at {agent.limits.weeklySlippage / 100}% of your money in any 7 days.
      </span>
    </div>
  )
}

/** What a locked agent has used, read from its session onchain: today's spend and trades, and this week's losses to prices. */
export function UsageCard(
  { agent, usage }: Readonly<{ agent: Agent; usage: AsyncResult.AsyncResult<AgentUsage, unknown> }>
) {
  return (
    <section aria-labelledby={`usage-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`usage-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">Usage</h3>
      <div className="grid gap-4 rounded-lg bg-white p-[18px] shadow-e2">
        {AsyncResult.isSuccess(usage) ?
          (
            <>
              {agent.limits.dailyBudget > BigInt(0) ?
                (
                  <UsageMeter
                    used={dollars(usage.value.spentToday)}
                    limit={dollars(agent.limits.dailyBudget)}
                    resetsAt="midnight UTC"
                  />
                ) :
                null}
              <Trades agent={agent} usage={usage.value} />
              <Slippage agent={agent} usage={usage.value} />
            </>
          ) :
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
