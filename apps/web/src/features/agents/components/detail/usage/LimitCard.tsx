import type { Agent, PolicyUsage } from "@bluechip/domain/agents/Agent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { UsageBar } from "@bluechip/ui/bluechip/usage-meter"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { formatDollars } from "@bluechip/ui/lib/agent-limits"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { toDollars, toEther } from "../../../model/fieldText.ts"
import { limitOf, standingOf } from "../../../model/usage.ts"
import { StandingPill } from "./StandingPill.tsx"

const LIMIT: Partial<
  Record<PolicyUsage["policy"], { readonly title: string; readonly illustration: IllustrationName }>
> = {
  trade: { title: "Daily budget", illustration: "wallet" },
  tradesPerDay: { title: "Trades today", illustration: "tally" },
  slippageBudget: { title: "Weekly slippage", illustration: "receipt" },
  gasBudget: { title: "Gas today", illustration: "bolt" }
}

const etherFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })

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
  const ether = counted.unit === "wei"
  const amount = (value: bigint) => dollars ? toDollars(value) : ether ? toEther(value) : Number(value)
  const used = amount(counted.used)
  const cap = limitOf(counted)
  const limit = cap === null ? null : amount(cap)
  const show = (value: number) =>
    dollars ? formatDollars(value) : ether ? `${etherFormat.format(value)} ETH` : value.toLocaleString("en-US")
  const standing = standingOf(counted)
  const { illustration, title } = LIMIT[counted.policy] ??
    { title: policyOf(counted.policy).title, illustration: "shield" as const }
  const weekly = counted.policy === "slippageBudget"
  const weeklyBps = configOf(agent.spec.policies, slippageBudget)?.weeklyBps

  const footer = weekly ?
    `What it lost to prices over the last 7 days${
      weeklyBps === undefined ? "" : `; it stops at ${formatPercent(weeklyBps)} of your money`
    }.` :
    limit === null ?
    (counted.policy === "tradesPerDay" ? "No limit of its own: its budget stops it first." : "No limit.") :
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
          {...(dollars || ether ? { format: show } : {})}
          className="text-[28px] leading-none font-semibold tracking-[-0.03em]"
        />
        <span className="text-label text-g-500 tabular-nums">
          {weekly ? "lost" : limit === null ? "today" : `used of ${show(limit)}`}
        </span>
      </div>

      {limit === null || limit === 0 || standing === "open" ?
        null :
        <UsageBar used={used} limit={limit} dayGone={dayGone} />}

      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">{footer}</p>
    </section>
  )
}
