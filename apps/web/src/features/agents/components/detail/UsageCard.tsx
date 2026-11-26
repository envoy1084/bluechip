import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { SectionHeader } from "../../../../components/layout/SectionHeader.tsx"
import { useNow } from "../../../../hooks/useNow.ts"
import { nextDailyReset, yourTime } from "../../../../lib/localTime.ts"
import { dayGone, shownLimits } from "../../model/usage.ts"
import { LimitCard } from "./usage/LimitCard.tsx"
import { UsageHero } from "./usage/UsageHero.tsx"

/**
 * What a locked agent has used, read from its session onchain: how much room it has left today, then each limit as a
 * card with how much is used and left, and when the daily ones start again (gas is bluechip's to watch).
 */
export function UsageCard(
  { agent, usage }: Readonly<{ agent: Agent; usage: AsyncResult.AsyncResult<AgentUsage, unknown> }>
) {
  const now = useNow(60_000)
  const resetAt = yourTime(nextDailyReset(now))

  return (
    <section aria-labelledby={`usage-${agent.id}`} className="grid content-start gap-4">
      <SectionHeader
        id={`usage-${agent.id}`}
        level="h3"
        title="Today's usage"
        description="Read from Base: the counts its policies check before every trade. The tick on a bar is how much of the day has gone."
      />

      {AsyncResult.isSuccess(usage) ?
        (
          <>
            <UsageHero agent={agent} usage={usage.value} now={now} resetAt={resetAt} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* The hero's headline and dial already say the daily budget; a card of it would say it a third time. */}
              {shownLimits(usage.value).filter((counted) => counted.policy !== "trade" || counted.limit === null).map((
                counted
              ) => (
                <LimitCard
                  key={counted.policy}
                  agent={agent}
                  counted={counted}
                  resetAt={resetAt}
                  dayGone={dayGone(now)}
                />
              ))}
            </div>
          </>
        ) :
        AsyncResult.isInitial(usage) ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-[244px] w-full rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {["a", "b", "c"].map((key) => <SkeletonBlock key={key} className="h-[186px] w-full rounded-lg" />)}
            </div>
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
