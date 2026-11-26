import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentPerformance } from "@bluechip/domain/performance/Performance"
import { PortfolioChart } from "@bluechip/ui/bluechip/portfolio-chart"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { cn } from "@bluechip/ui/lib/cn"
import { formatChange, formatDate } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { IllustratedEmpty } from "../../../../../components/IllustratedEmpty.tsx"
import { usdcDollars } from "../../../../../lib/amounts.ts"
import { returnPercent } from "../../../../../lib/performance.ts"
import { agentPerformanceAtom } from "../../../atoms/performance.ts"
import { DriftPanel, MoneyMoved, PolicyDecisions, TradeCosts } from "./ResultsPanels.tsx"

/** Profit and loss signed and colored: gains green, losses red, nothing grey. */
const tone = (amount: bigint) => amount > BigInt(0) ? "text-gain" : amount < BigInt(0) ? "text-loss" : "text-g-600"

/** What it made in all, split into what its sales locked in and what it holds now. */
function Contribution({ performance }: Readonly<{ performance: AgentPerformance }>) {
  const profit = performance.realised + performance.unrealised
  const percent = returnPercent(profit, performance.bought)

  return (
    <section
      aria-label="Its contribution"
      className="grid content-start gap-5 rounded-lg bg-white p-5 shadow-e2"
    >
      <div className="grid gap-1">
        <span className="text-label text-g-600">Its contribution</span>
        <b className={cn("text-[34px] leading-[1.1] font-semibold tracking-[-0.035em] tabular-nums", tone(profit))}>
          {formatChange(usdcDollars(profit))}
        </b>
        {percent === null ?
          <span className="text-label-sm text-g-500">Nothing bought yet</span> :
          (
            <span className="flex flex-wrap items-center gap-1.5 text-label-sm text-g-500">
              <PriceChange value={percent} size="sm" />
              on what it bought
            </span>
          )}
      </div>
      <dl className="grid gap-3 border-t border-g-100 pt-4">
        {[
          { label: "Realised", hint: "Locked in by its sales", amount: performance.realised },
          { label: "Unrealised", hint: "On what it bought and you still hold", amount: performance.unrealised }
        ].map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <dt className="text-[13.5px] font-medium">{row.label}</dt>
              <dd className="text-caption text-g-500">{row.hint}</dd>
            </div>
            <dd className={cn("text-[15px] font-semibold tabular-nums", tone(row.amount))}>
              {formatChange(usdcDollars(row.amount))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * What the agent contributed: its profit over time and in all, what it moved and what that cost, how its policies
 * decided, and, for a rebalancer, its drift from its target mix.
 */
export function AgentResults({ agent }: Readonly<{ agent: Agent }>) {
  const result = useAtomValue(agentPerformanceAtom(agent.id))
  const refresh = useAtomRefresh(agentPerformanceAtom(agent.id))

  if (AsyncResult.isInitial(result)) {
    return (
      <div aria-busy className="grid gap-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <SkeletonBlock className="h-[320px] w-full rounded-lg" />
          <SkeletonBlock className="h-[320px] w-full rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {["a", "b", "c"].map((key) => <SkeletonBlock key={key} className="h-[200px] w-full rounded-lg" />)}
        </div>
      </div>
    )
  }
  if (!AsyncResult.isSuccess(result)) {
    return (
      <div className="grid justify-items-center gap-3 rounded-lg bg-white py-10 text-center shadow-e2">
        <p className="text-body-sm text-g-600">We couldn't read its results just now. Try again in a moment.</p>
        <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }

  const performance = result.value
  if (performance.trades === 0 && performance.decided === 0 && performance.drift === null) {
    return (
      <IllustratedEmpty illustration="chart" title="No results yet">
        Once {agent.name} trades, its profit, what it bought and sold, and its costs show up here.
      </IllustratedEmpty>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <PortfolioChart
          title="Profit and loss"
          measure="profit"
          ranges={[{
            id: "All",
            description: "Since its first trade",
            points: performance.series.map((point) => ({
              value: usdcDollars(point.total),
              label: formatDate(new Date(`${point.day}T12:00:00Z`))
            }))
          }]}
        />
        <Contribution performance={performance} />
      </div>
      <div className="grid items-start gap-4 md:grid-cols-3">
        <MoneyMoved performance={performance} />
        <TradeCosts performance={performance} />
        <PolicyDecisions performance={performance} />
        {performance.drift === null ? null : <DriftPanel drift={performance.drift} />}
      </div>
    </div>
  )
}
