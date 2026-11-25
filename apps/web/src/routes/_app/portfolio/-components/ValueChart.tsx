import { PortfolioChart } from "@bluechip/ui/bluechip/portfolio-chart"
import { formatDate } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { portfolioHistoryAtom } from "../../../../atoms/portfolio.ts"
import { usdcDollars } from "../../../../lib/amounts.ts"

/** The portfolio's value over the last 30 days: a snapshot every 4 hours, ending now. */
export function ValueChart() {
  const history = useAtomValue(portfolioHistoryAtom)
  const points = AsyncResult.isSuccess(history) ? history.value : []

  if (AsyncResult.isSuccess(history) && points.length < 2) {
    return (
      <section className="grid gap-1 rounded-lg bg-white px-5 py-[18px] shadow-e2">
        <b className="text-[14.5px] font-semibold tracking-[-0.01em]">Portfolio value</b>
        <p className="text-body-sm text-g-600">
          Your chart starts building today. We record your portfolio's value every 4 hours and keep the last 30 days.
        </p>
      </section>
    )
  }

  return (
    <PortfolioChart
      title="Portfolio value"
      loading={AsyncResult.isInitial(history)}
      ranges={[{
        id: "1M",
        description: "Past 30 days",
        points: points.map((point) => ({
          value: usdcDollars(point.value),
          label: formatDate(DateTime.toDateUtc(point.at))
        }))
      }]}
    />
  )
}
