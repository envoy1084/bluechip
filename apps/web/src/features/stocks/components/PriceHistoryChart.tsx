import type { Stock } from "@bluechip/domain/market/Market"
import { PortfolioChart, type PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { formatDate, formatTime } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { bpsPercent, priceDollars } from "../../../lib/amounts.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { historiesAtom, HISTORY_RANGES } from "../atoms/history.ts"

const weekday = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(at)

const dayMonth = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(at)

/**
 * A stock's price over time, with 1D / 1W / 1M / All tabs, in the viewer's time. The past day ends at the price the
 * page heads with, and its change is the header's (from 24 hours ago), so the page says one move for the day.
 */
export function PriceHistoryChart({ stock }: Readonly<{ stock: Stock }>) {
  const histories = useAtomValue(historiesAtom(stock.symbol))
  const ranges = useMemo(() => {
    const zone = localTimeZone()
    const live = stock.price === null ? null : priceDollars(stock.price.price)
    return HISTORY_RANGES.map(({ id, label, description }, index): PortfolioRange => {
      const points = Option.getOrElse(AsyncResult.value(histories[index]!), () => []).map((point) => {
        const at = DateTime.toDateUtc(point.at)
        return id === "1D" ?
          {
            value: priceDollars(point.price),
            label: formatDate(at, { timeZone: zone }),
            tick: `${weekday(at, zone)} ${formatTime(at, { timeZone: zone })}`
          } :
          {
            value: priceDollars(point.price),
            label: formatDate(at, { timeZone: zone, time: false }),
            tick: dayMonth(at, zone)
          }
      })
      if (id !== "1D" || live === null || stock.change24h === null || points.length === 0) {
        return { id: label, description, points }
      }
      const percent = bpsPercent(stock.change24h)
      return {
        id: label,
        description,
        points: [...points, { value: live, label: "Now", tick: "Now" }],
        change: { percent, amount: live - live / (1 + percent / 100) }
      }
    })
  }, [histories, stock.price, stock.change24h])

  return (
    <PortfolioChart
      ranges={ranges}
      defaultRange="1D"
      title="Price"
      loading={histories.some(AsyncResult.isInitial)}
    />
  )
}
