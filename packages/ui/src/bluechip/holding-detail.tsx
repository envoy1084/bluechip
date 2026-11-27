import type { ReactNode } from "react"
import { SkeletonBlock } from "../components/skeleton.tsx"
import { cn } from "../lib/cn.ts"
import { formatChange, formatMoney, formatShareCount } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { AgentAvatar } from "./agent-avatar.tsx"
import { PriceChange } from "./price-change.tsx"
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

const toneOf = (amount: number) => amount > 0 ? "text-gain" : amount < 0 ? "text-loss" : "text-g-600"

/** One figure of the holding: its label, the figure, and a line under it. */
function Figure({ label, value, detail, className }: {
  readonly label: string
  readonly value: ReactNode
  readonly detail: ReactNode
  readonly className?: string
}) {
  return (
    <div className="grid content-start gap-1">
      <dt className="text-label-sm text-g-500">{label}</dt>
      <dd className="grid gap-1">
        <span className={cn("text-[20px] leading-tight font-semibold tracking-[-0.02em] tabular-nums", className)}>
          {value}
        </span>
        <span className="text-label-sm text-g-500">{detail}</span>
      </dd>
    </div>
  )
}

/**
 * One holding, compact: what it's worth and how much of your money it is, how it moved today, what it returned on
 * what you paid, and the agents that trade it. Values roll as prices move.
 */
export function HoldingDetail(
  { symbol, name, shares, price, dayChangePercent, cost, weight, cap, agents = NO_AGENTS, actions, className }:
    HoldingDetailProps
) {
  const value = shares * price
  const dayChange = value - value / (1 + dayChangePercent / 100)
  const gain = cost === undefined ? undefined : value - cost

  return (
    <section
      data-slot="holding-detail"
      aria-label={`Your ${name}`}
      className={cn("@container grid gap-5 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <TickerChip symbol={symbol} />
          <span className="grid">
            <b className="text-[16px] font-semibold">Your {name}</b>
            <span className="text-label-sm text-g-500">{formatShareCount(shares)} at {formatMoney(price)}</span>
          </span>
        </span>
        {actions === undefined ? null : <span className="flex gap-2">{actions}</span>}
      </header>

      <dl className="grid gap-x-4 gap-y-4 border-t border-g-100 pt-4 @md:grid-cols-3">
        <Figure
          label="Value"
          value={<NumberRoll value={value} format={formatMoney} />}
          detail={`${Math.round(weight)}% of your money${cap === undefined ? "" : `, ${cap}% at most`}`}
        />
        <Figure
          label="Today"
          value={formatChange(dayChange)}
          detail={<PriceChange value={dayChangePercent} size="md" />}
          className={toneOf(dayChange)}
        />
        {gain === undefined || cost === undefined ? null : (
          <Figure
            label="Return"
            value={formatChange(gain)}
            detail={
              <span className="inline-flex flex-wrap items-center gap-1">
                <PriceChange value={cost > 0 ? (gain / cost) * 100 : 0} size="md" />
                <span>{`on ${formatMoney(cost)} paid`}</span>
              </span>
            }
            className={toneOf(gain)}
          />
        )}
      </dl>

      {agents.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2 border-t border-g-100 pt-4">
          <span className="text-label-sm text-g-500">Traded by</span>
          <ul aria-label="Agents that trade it" className="flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-g-50 py-0.5 pr-2.5 pl-0.5 text-label-sm"
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
    </div>
  )
}
