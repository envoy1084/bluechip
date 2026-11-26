import type { PortfolioPerformance } from "@bluechip/domain/performance/Performance"
import { PortfolioChart } from "@bluechip/ui/bluechip/portfolio-chart"
import { Tabs, TabsList, TabsTab } from "@bluechip/ui/components/tabs"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { portfolioHistoryAtom } from "../../../atoms/portfolio.ts"
import { profitRanges, valueRanges } from "../model/chartRanges.ts"

type Measure = "value" | "profit"

/**
 * Your portfolio over time, as its value (a snapshot every 4 hours over 30 days) or its profit and loss (each day
 * since your first trade), one toggle apart.
 */
export function HistoryChart(
  { performance }: Readonly<{ performance: AsyncResult.AsyncResult<PortfolioPerformance, unknown> }>
) {
  const history = useAtomValue(portfolioHistoryAtom)
  const [measure, setMeasure] = useState<Measure>("value")

  const points = AsyncResult.isSuccess(history) ? history.value : []
  const series = AsyncResult.isSuccess(performance) ? performance.value.series : []
  const waitingForValue = measure === "value" && AsyncResult.isSuccess(history) && points.length < 2
  const missingProfit = measure === "profit" && AsyncResult.isFailure(performance)

  return (
    <section aria-label="Portfolio over time" className="grid rounded-lg bg-white pt-4 shadow-e2">
      <Tabs
        variant="segmented"
        value={measure}
        onValueChange={(value) => setMeasure(value as Measure)}
        className="px-5"
      >
        <TabsList
          aria-label="Chart"
          className="w-fit [&_[role=tab]]:h-[26px] [&_[role=tab]]:px-3 [&_[role=tab]]:text-label-sm"
        >
          <TabsTab value="value">Value</TabsTab>
          <TabsTab value="profit">Profit</TabsTab>
        </TabsList>
      </Tabs>

      {waitingForValue ?
        (
          <p className="px-5 pt-4 pb-5 text-body-sm text-g-600">
            Your chart starts building today. We record your portfolio's value every 4 hours and keep the last 30 days.
          </p>
        ) :
        missingProfit ?
        (
          <p className="px-5 pt-4 pb-5 text-body-sm text-g-600">
            We couldn't load your results. Try again in a moment.
          </p>
        ) :
        (
          <PortfolioChart
            // A new chart per measure, so its range and focus start over.
            key={measure}
            title={measure === "value" ? "Portfolio value" : "Profit and loss"}
            measure={measure}
            loading={measure === "value" ? AsyncResult.isInitial(history) : AsyncResult.isInitial(performance)}
            ranges={measure === "value" ? valueRanges(points) : profitRanges(series)}
            height={170}
            className="rounded-none bg-transparent pt-3 shadow-none"
          />
        )}
    </section>
  )
}
