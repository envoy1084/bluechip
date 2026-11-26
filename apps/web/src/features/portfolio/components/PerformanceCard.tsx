import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import { PortfolioChart } from "@bluechip/ui/bluechip/portfolio-chart"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { formatChange, formatDate, formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"
import { costsSentence, gasEth, returnPercent } from "../../../lib/performance.ts"

/**
 * How you're doing: profit in all (realised by sales and unrealised on what you hold, FIFO), what your trades cost,
 * and each day's profit since your first trade.
 */
export function PerformanceCard({ performance }: Readonly<{ performance: PortfolioPerformance }>) {
  const profit = performance.realised + performance.unrealised
  const percent = returnPercent(profit, performance.cost)

  return (
    <section aria-labelledby="performance-title" className="grid gap-4">
      <div className="grid gap-4 rounded-lg bg-white px-5 py-[18px] shadow-e2">
        <div className="grid gap-0.5">
          <h2 id="performance-title" className="text-[14.5px] font-semibold tracking-[-0.01em]">How you're doing</h2>
          <p className="text-label-sm text-g-500">
            Cost is what you paid for the shares you still hold, oldest shares sold first.
          </p>
        </div>
        <StatGrid>
          <StatTile
            label="Profit in all"
            value={formatChange(usdcDollars(profit))}
            detail={percent === null ? "Nothing held yet" : <PriceChange value={percent} size="sm" />}
          />
          <StatTile
            label="Realised"
            value={formatChange(usdcDollars(performance.realised))}
            detail="From what you sold"
          />
          <StatTile
            label="Unrealised"
            value={formatChange(usdcDollars(performance.unrealised))}
            detail={`On ${formatMoney(usdcDollars(performance.cost))} you paid`}
          />
          <StatTile
            label="Costs"
            value={formatMoney(usdcDollars(performance.costs.fees + performance.costs.slippage))}
            detail={`${gasEth(performance.costs.gasWei)} of gas`}
          />
        </StatGrid>
        <p className="text-label-sm text-g-600">
          {performance.trades === 0 ?
            "No trades yet." :
            `${performance.trades} ${performance.trades === 1 ? "trade" : "trades"}: ${
              costsSentence(performance.costs)
            }.`}
        </p>
        {performance.flagged === 0 ? null : (
          <p className="text-label-sm text-g-600">
            {performance.flagged === 1 ? "One balance change" : `${performance.flagged} balance changes`}{" "}
            came from outside bluechip. They count at the market price when we found them.
          </p>
        )}
      </div>

      <PortfolioChart
        title="Profit and loss"
        measure="profit"
        ranges={[{
          id: "All",
          description: "Since your first trade",
          points: performance.series.map((point) => ({
            value: usdcDollars(point.total),
            label: formatDate(new Date(`${point.day}T12:00:00Z`))
          }))
        }]}
      />
    </section>
  )
}
