import type { AgentPerformance } from "@bluechip/domain/performance/Performance"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatPercent } from "@bluechip/domain/policies/Format"
import { LineChart } from "@bluechip/ui/components/chart"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { formatDate, formatMoney } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import type { ReactNode } from "react"
import { usdcDollars } from "../../../../../lib/amounts.ts"
import { costShare } from "../../../model/results.ts"

/** A results card: an illustration, a title and what it's about, then its body; a last `mt-auto` child sits at the bottom. */
function Panel(
  { illustration, title, sub, children, className }: Readonly<{
    illustration: IllustrationName
    title: string
    sub: string
    children: ReactNode
    className?: string
  }>
) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-4 rounded-lg bg-white p-5 shadow-e2", className)}>
      <header className="flex items-center gap-3">
        <Illustration name={illustration} size={40} label="" aria-hidden className="shrink-0" />
        <div className="grid gap-0.5">
          <h4 className="text-[14.5px] font-semibold tracking-[-0.01em]">{title}</h4>
          <p className="text-label-sm text-g-500">{sub}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

/** One labelled amount, with a bar for its share of the row's whole. */
function ShareRow(
  { label, value, share, tone }: Readonly<{ label: string; value: string; share: number; tone: string }>
) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-[13.5px] text-g-700">
          <i aria-hidden className={cn("size-2 rounded-full", tone)} />
          {label}
        </span>
        <b className="text-[13.5px] font-semibold tabular-nums">{value}</b>
      </div>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-g-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
  )
}

/** What it bought and sold, side by side, and how many trades that took. */
export function MoneyMoved({ performance }: Readonly<{ performance: AgentPerformance }>) {
  const bought = usdcDollars(performance.bought)
  const sold = usdcDollars(performance.sold)
  const most = Math.max(bought, sold, 1)

  return (
    <Panel
      illustration="coins"
      title="Money moved"
      sub={`${performance.trades} ${performance.trades === 1 ? "trade" : "trades"} filled`}
    >
      <div className="grid gap-3">
        <ShareRow label="Bought" value={formatMoney(bought)} share={bought / most} tone="bg-blue" />
        <ShareRow label="Sold" value={formatMoney(sold)} share={sold / most} tone="bg-g-400" />
      </div>
      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">
        {bought >= sold ?
          `${formatMoney(bought - sold)} more put into stocks than taken out.` :
          `${formatMoney(sold - bought)} more taken out of stocks than put in.`}
      </p>
    </Panel>
  )
}

/** What its trades cost beyond the stocks: the pools' fees and slippage against Chainlink. */
export function TradeCosts({ performance }: Readonly<{ performance: AgentPerformance }>) {
  const { costs } = performance
  const { dollars, percent } = costShare(performance)
  const fees = usdcDollars(costs.fees)
  const slippage = usdcDollars(costs.slippage)
  const most = Math.max(fees, Math.abs(slippage), 0.01)

  return (
    <Panel
      illustration="receipt"
      title="What it cost"
      sub="Pool fees and slippage"
    >
      <b className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
        {formatMoney(usdcDollars(dollars))}
      </b>
      <div className="grid gap-3">
        <ShareRow label="Pool fees" value={formatMoney(fees)} share={fees / most} tone="bg-[#f5b400]" />
        <ShareRow
          label={slippage < 0 ? "Better than Chainlink" : "Slippage"}
          value={formatMoney(Math.abs(slippage))}
          share={Math.abs(slippage) / most}
          tone={slippage < 0 ? "bg-gain" : "bg-loss"}
        />
      </div>
      <p className="mt-auto border-t border-g-100 pt-3 text-label-sm text-g-600">
        {percent === null ?
          "Nothing traded yet." :
          `${formatPercent(Math.round(percent * 100))} of the ${
            formatMoney(usdcDollars(performance.bought + performance.sold))
          } it traded.`}
      </p>
    </Panel>
  )
}

/** How many of the trades it tried its policies let through, and which ones held it back. */
export function PolicyDecisions({ performance }: Readonly<{ performance: AgentPerformance }>) {
  const passed = Math.max(0, performance.decided - performance.blocked)
  const share = performance.decided === 0 ? 0 : passed / performance.decided

  return (
    <Panel
      illustration="shield"
      title="Its policies"
      sub={performance.decided === 0 ?
        "Nothing tried yet" :
        `${performance.decided} ${performance.decided === 1 ? "trade" : "trades"} checked onchain`}
    >
      <div className="flex items-baseline gap-2">
        <b className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums">{passed}</b>
        <span className="text-label-sm text-g-500">passed, {performance.blocked} blocked</span>
      </div>
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-g-100">
        <div className="h-full bg-gain" style={{ width: `${share * 100}%` }} />
        <div className="h-full bg-loss" style={{ width: `${performance.decided === 0 ? 0 : (1 - share) * 100}%` }} />
      </div>
      {performance.blockedBy.length === 0 ?
        (
          <p className="mt-auto flex items-center gap-1.5 border-t border-g-100 pt-3 text-label-sm text-g-600">
            <Icon name="check-circle" size={14} className="text-gain" />
            {performance.decided === 0 ? "Its first trade shows here." : "None of its trades were blocked."}
          </p>
        ) :
        (
          <ul className="mt-auto grid gap-2 border-t border-g-100 pt-3">
            {performance.blockedBy.map((row) => (
              <li key={row.policy} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="flex items-center gap-2 text-g-700">
                  <Icon name="stop-sign" size={13} className="text-loss" />
                  {policyOf(row.policy).title}
                </span>
                <b className="font-semibold tabular-nums">{row.count === 1 ? "once" : `${row.count} times`}</b>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  )
}

/** A rebalancer's distance from its target mix over the last 30 days, against where it rebalances. */
export function DriftPanel({ drift }: Readonly<{ drift: NonNullable<AgentPerformance["drift"]> }>) {
  const latest = drift.at(-1)
  if (latest === undefined) return null
  const off = latest.driftBps >= latest.triggerBps

  return (
    <Panel
      illustration="target"
      title="Drift from its target mix"
      sub={`It rebalances once the mix is ${formatPercent(latest.triggerBps)} off`}
      className="md:col-span-3"
    >
      <div className="flex items-baseline gap-2">
        <b className="text-[26px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {formatPercent(latest.driftBps)}
        </b>
        <span className={cn("text-label-sm font-medium", off ? "text-warn" : "text-gain")}>
          {off ? "off target, it will rebalance" : "within its band"}
        </span>
      </div>
      {drift.length < 2 ? null : (
        <LineChart
          title="Drift from its target mix, last 30 days"
          labels={drift.map((point) => formatDate(DateTime.toDateUtc(point.at)))}
          series={[
            { key: "drift", label: "Drift", values: drift.map((point) => point.driftBps / 100) },
            {
              key: "trigger",
              label: "Rebalances at",
              values: drift.map((point) => point.triggerBps / 100),
              color: "var(--color-g-300)"
            }
          ]}
          height={180}
          formatValue={(value) => `${value.toFixed(1)}%`}
          formatTick={(value) => `${value}%`}
        />
      )}
    </Panel>
  )
}
