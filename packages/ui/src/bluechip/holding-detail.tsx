import type { ReactNode } from "react"
import { SkeletonBlock } from "../components/skeleton.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney, formatShareCount } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { AgentAvatar } from "./agent-avatar.tsx"
import { AllocationBar } from "./allocation-bar.tsx"
import { PriceChange } from "./price-change.tsx"
import { StatGrid, StatTile } from "./stat-tile.tsx"
import { TickerChip } from "./ticker-chip.tsx"

export interface HoldingDetailProps {
  readonly symbol: string
  readonly name: string
  readonly shares: number
  /** One share now, in dollars. */
  readonly price: number
  /** Today's move of one share, in percent. */
  readonly dayChangePercent: number
  /** What you paid for these shares in all, when known; without it there's no return. */
  readonly cost?: number
  /** Its share of your money, in percent. */
  readonly weight: number
  /** The most an agent may put in one stock, in percent. */
  readonly cap?: number
  /** The agents that trade it. */
  readonly agents?: ReadonlyArray<{ readonly id: string; readonly name: string }>
  /** Buy and Sell. */
  readonly actions?: ReactNode
  readonly className?: string
}

const NO_AGENTS: ReadonlyArray<{ readonly id: string; readonly name: string }> = []

/**
 * One holding up close: what it's worth, how it moved today, what it returned, how much of your money it is, and
 * the agents that trade it. Values roll as prices move.
 */
export function HoldingDetail(
  { symbol, name, shares, price, dayChangePercent, cost, weight, cap, agents = NO_AGENTS, actions, className }:
    HoldingDetailProps
) {
  const value = shares * price
  const dayChange = value - value / (1 + dayChangePercent / 100)

  return (
    <section
      data-slot="holding-detail"
      aria-label={`Your ${name}`}
      className={cn("grid gap-5 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <TickerChip symbol={symbol} />
          <span className="grid">
            <b className="text-[16px] font-semibold">{name}</b>
            <span className="text-label-sm text-g-500">{formatShareCount(shares)} at {formatMoney(price)}</span>
          </span>
        </span>
        {actions === undefined ? null : <span className="flex gap-2">{actions}</span>}
      </header>

      <StatGrid>
        <StatTile label="Value" value={<NumberRoll value={value} format={formatMoney} />} />
        <StatTile label="Today" value={<PriceChange value={dayChangePercent} amount={dayChange} size="lg" />} />
        {cost === undefined ? null : (
          <StatTile
            label="Return"
            value={<PriceChange value={cost > 0 ? ((value - cost) / cost) * 100 : 0} amount={value - cost} size="lg" />}
            detail={`You paid ${formatMoney(cost)}`}
          />
        )}
      </StatGrid>

      <div className="grid gap-2">
        <span className="flex items-baseline justify-between gap-2 text-label">
          <span className="text-g-500">Share of your money</span>
          <b className="font-semibold tabular-nums">
            {Math.round(weight)}%{cap === undefined ? "" : ` of ${cap}% max`}
          </b>
        </span>
        <AllocationBar label={name} weight={weight} cap={cap ?? 100} />
      </div>

      {agents.length === 0 ? null : (
        <div className="grid gap-2 border-t border-g-100 pt-4">
          <span className="text-label-sm font-semibold text-g-500">Agents that trade it</span>
          <ul className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-g-50 py-0.5 pr-2.5 pl-0.5 text-label"
              >
                <AgentAvatar agentId={agent.id} size="sm" />
                {agent.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** A holding's detail while it loads. */
export function HoldingDetailSkeleton({ className }: { readonly className?: string }) {
  return (
    <div
      aria-busy
      aria-label="Loading the holding"
      className={cn("grid gap-5 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <div className="flex items-center gap-2.5">
        <SkeletonBlock className="size-9 rounded-md" />
        <div className="grid gap-1.5">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-3 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {["a", "b", "c"].map((id) => <SkeletonBlock key={id} className="h-11 w-full" />)}
      </div>
      <SkeletonBlock className="h-8 w-full" />
    </div>
  )
}
