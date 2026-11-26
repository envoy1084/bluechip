import type { ReactNode } from "react"
import { SkeletonBlock } from "../components/skeleton.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { AgentAvatar } from "./agent-avatar.tsx"
import { AGENT_STATES, type AgentState, AgentStatus } from "./agent-status.tsx"
import { StatGrid, StatTile } from "./stat-tile.tsx"
import { UsageMeter } from "./usage-meter.tsx"

export interface AgentSummaryProps {
  readonly agentId: string
  readonly name: string
  readonly state: AgentState
  /** What it does, in one line: "Buys and sells Nvidia and Apple". */
  readonly does: string
  /** Spent on buys today, and its daily budget; a sell-only agent has no budget (0). */
  readonly spentToday: number
  readonly dailyBudget: number
  /** When today's budget starts again: "midnight UTC". */
  readonly resetsAt?: string
  /** Trades made today and the most it may make. */
  readonly tradesToday: number
  readonly tradesPerDay: number
  /** Its last trade, as a sentence: "Bought $50.00 of Apple at 09:41". */
  readonly lastTrade?: string
  /** "21 Feb". */
  readonly lockedUntil: string
  /** Pause, Edit rules. */
  readonly actions?: ReactNode
  readonly className?: string
}

/**
 * An agent at a glance: who it is and what it's doing, what it does, today's use against its limits, its last trade
 * and how long its rules are locked.
 */
export function AgentSummary(
  {
    agentId,
    name,
    state,
    does,
    spentToday,
    dailyBudget,
    resetsAt,
    tradesToday,
    tradesPerDay,
    lastTrade,
    lockedUntil,
    actions,
    className
  }: AgentSummaryProps
) {
  return (
    <section
      data-slot="agent-summary"
      aria-label={name}
      className={cn("grid gap-4 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <header className="flex flex-wrap items-center gap-3">
        <AgentAvatar agentId={agentId} size="lg" status={AGENT_STATES[state].dot} />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <b className="truncate text-[16px] font-semibold">{name}</b>
            <AgentStatus state={state} />
          </span>
          <span className="text-label text-g-500">{does}</span>
        </span>
        {actions === undefined ? null : <span className="flex gap-2">{actions}</span>}
      </header>

      {dailyBudget > 0 ?
        <UsageMeter used={spentToday} limit={dailyBudget} {...(resetsAt === undefined ? {} : { resetsAt })} /> :
        null}

      <StatGrid>
        <StatTile label="Trades today" value={`${tradesToday} of ${tradesPerDay}`} />
        <StatTile label="Locked until" value={lockedUntil} />
        {dailyBudget > 0 ? null : <StatTile label="Spends" value={formatMoney(0)} detail="It only sells" />}
      </StatGrid>

      <p className="border-t border-g-100 pt-3 text-label text-g-600">
        {lastTrade === undefined ? "No trades yet." : `Last: ${lastTrade.charAt(0).toLowerCase()}${lastTrade.slice(1)}`}
      </p>
    </section>
  )
}

/** An agent's summary while it loads. */
export function AgentSummarySkeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-busy
      aria-label="Loading the agent"
      className={cn("grid gap-4 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <div className="flex items-center gap-3">
        <SkeletonBlock className="size-11 rounded-[12px]" />
        <div className="grid gap-1.5">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-3 w-48" />
        </div>
      </div>
      <SkeletonBlock className="h-9 w-full" />
      <SkeletonBlock className="h-10 w-2/3" />
    </div>
  )
}
