import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { PriceChange, priceDirection } from "@bluechip/ui/bluechip/price-change"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { cn } from "@bluechip/ui/lib/cn"
import { formatChange, formatMoney } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { usdcDollars } from "../../../lib/amounts.ts"
import { moneySummary } from "../../../lib/moneySummary.ts"
import { costsSentence, returnPercent } from "../../../lib/performance.ts"

const TONE = { up: "text-gain", down: "text-loss", flat: "text-ink" } as const

/**
 * Your money in one card: what it's worth and today's move, your profit in all (realised by sales and unrealised on
 * what you hold, FIFO), and what your trades cost.
 */
export function SummaryCard(
  { portfolio, performance }: Readonly<{
    portfolio: Portfolio
    performance: AsyncResult.AsyncResult<PortfolioPerformance, unknown>
  }>
) {
  const { value, dayChange, dayChangePercent } = moneySummary(portfolio, (symbol) => symbol)

  return (
    <section
      aria-labelledby="summary-title"
      className="grid gap-4 rounded-lg bg-white px-5 py-[18px] shadow-e2"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="grid gap-1">
          <h2 id="summary-title" className="text-label text-g-500">Your money</h2>
          <NumberRoll
            value={value}
            format={formatMoney}
            className="text-[32px] leading-none font-semibold tracking-[-0.04em]"
          />
          <span className="flex flex-wrap items-center gap-1.5 text-label text-g-500">
            <PriceChange value={dayChangePercent} amount={dayChange} />
            today
          </span>
        </div>

        {AsyncResult.isInitial(performance) && (
          <div aria-busy className="grid gap-2">
            <SkeletonBlock className="h-3.5 w-20" />
            <SkeletonBlock className="h-6 w-32" />
          </div>
        )}
        {AsyncResult.isSuccess(performance) && <ProfitInAll performance={performance.value} />}
      </div>

      {AsyncResult.isSuccess(performance) && <Breakdown performance={performance.value} />}
    </section>
  )
}

function ProfitInAll({ performance }: Readonly<{ performance: PortfolioPerformance }>) {
  const profit = performance.realised + performance.unrealised
  const percent = returnPercent(profit, performance.cost)

  return (
    <div className="grid gap-1 sm:justify-items-end sm:text-right">
      <span className="text-label text-g-500">Profit in all</span>
      <b
        className={cn(
          "text-[22px] leading-none font-semibold tracking-[-0.03em] tabular-nums",
          TONE[priceDirection(usdcDollars(profit))]
        )}
      >
        {formatChange(usdcDollars(profit))}
      </b>
      <span className="flex flex-wrap items-center gap-1.5 text-label text-g-500">
        {percent === null ? "Nothing held yet" : (
          <>
            <PriceChange value={percent} />
            on {formatMoney(usdcDollars(performance.cost))} you paid
          </>
        )}
      </span>
    </div>
  )
}

function Breakdown({ performance }: Readonly<{ performance: PortfolioPerformance }>) {
  const figures = [
    { label: "Realised", value: formatChange(usdcDollars(performance.realised)) },
    { label: "Unrealised", value: formatChange(usdcDollars(performance.unrealised)) },
    { label: "Costs", value: formatMoney(usdcDollars(performance.costs.fees + performance.costs.slippage)) }
  ]

  return (
    <div className="grid gap-2.5 border-t border-g-100 pt-3.5">
      <dl className="grid grid-cols-3 gap-3">
        {figures.map((figure) => (
          <div key={figure.label} className="grid gap-0.5">
            <dt className="text-label-sm text-g-500">{figure.label}</dt>
            <dd className="text-body-sm font-semibold text-g-800 tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-label-sm text-g-500">
        {performance.trades === 0 ?
          "No trades yet." :
          `${performance.trades} ${performance.trades === 1 ? "trade" : "trades"}: ${
            costsSentence(performance.costs)
          }.`}
      </p>
      {performance.flagged === 0 ? null : (
        <p className="text-label-sm text-g-500">
          {performance.flagged === 1 ? "One balance change" : `${performance.flagged} balance changes`}{" "}
          came from outside bluechip. They count at the market price when we found them.
        </p>
      )}
    </div>
  )
}
