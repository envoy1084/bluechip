import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { UsageDial } from "@bluechip/ui/bluechip/usage-dial"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { cn } from "@bluechip/ui/lib/cn"
import { useNow } from "../../../../../hooks/useNow.ts"
import { toDollars } from "../../../model/fieldText.ts"
import { countdown, dayGone, shownLimits, todayRoom } from "../../../model/usage.ts"
import { StandingPill } from "./StandingPill.tsx"

/** The time left until the daily counts start again, ticking each second. */
function ResetCountdown({ resetAt }: Readonly<{ resetAt: string }>) {
  const now = useNow(1000)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3.5 py-2.5 surface-well">
      <Icon name="clock" size={16} className="text-blue" />
      <span className="text-label-sm text-g-600">Starts again in</span>
      {/* A timer is silent to screen readers by default, so the tick doesn't announce itself each second. */}
      <span role="timer" className="text-[17px] leading-none font-semibold tracking-[-0.01em] tabular-nums">
        {countdown(now)}
      </span>
      <span className="text-label-sm text-g-500">at {resetAt} your time, midnight UTC</span>
    </div>
  )
}

/**
 * Today at a glance: how much room the agent has left in a headline and a sentence, the time until its counts start
 * again, and its daily budget (or, without one, its trades) on a dial against the day. An hourglass runs while it
 * has room; once a limit is used up, a moon waits for midnight.
 */
export function UsageHero(
  { agent, usage, now, resetAt }: Readonly<{ agent: Agent; usage: AgentUsage; now: Date; resetAt: string }>
) {
  const room = todayRoom(usage, agent.name, now)
  const shown = shownLimits(usage)
  const dialed = shown.find((counted) => counted.policy === "trade" && counted.limit !== null) ??
    shown.find((counted) => counted.policy === "tradesPerDay" && counted.limit !== null)
  const dollars = dialed?.unit === "usd"
  const amount = (value: bigint) => dollars ? toDollars(value) : Number(value)

  return (
    <section
      aria-label="Room left today"
      className={cn(
        "grid items-center gap-6 rounded-lg bg-white p-5 shadow-e2 sm:p-6",
        dialed === undefined ?
          "sm:grid-cols-[auto_minmax(0,1fr)]" :
          "md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(0,1fr)_auto]"
      )}
    >
      <Illustration
        name={room.standing === "used" ? "moon" : "hourglass"}
        variant="halftone"
        size={148}
        animate
        className={cn("justify-self-center", dialed === undefined ? "max-sm:hidden" : "hidden lg:block")}
      />

      <div className="grid content-center gap-4">
        <div className="grid gap-2">
          <StandingPill standing={room.standing} />
          <h4 className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance">{room.headline}</h4>
          <p className="max-w-[56ch] text-body-sm text-pretty text-g-600">{room.detail}</p>
        </div>
        <ResetCountdown resetAt={resetAt} />
      </div>

      {dialed === undefined ? null : (
        <UsageDial
          label={dialed.policy === "trade" ? "Daily budget" : "Trades today"}
          used={amount(dialed.used)}
          limit={dialed.limit === null ? null : amount(dialed.limit)}
          dayGone={dayGone(now)}
          {...(dollars ? { format: (value: number) => formatDollars(value) } : {})}
          className="justify-self-center"
        />
      )}
    </section>
  )
}
