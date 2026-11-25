import type { StockSymbol } from "@bluechip/domain/market/Market"
import { PortfolioChart, type PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { formatDate, formatTime, MARKET_TIME_ZONE } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { priceDollars } from "../../../lib/amounts.ts"
import { historiesAtom, HISTORY_RANGES } from "../atoms/history.ts"

/** A stock's price over time, with 1D / 1W / 1M / All tabs. */
export function PriceHistoryChart({ symbol }: Readonly<{ symbol: StockSymbol }>) {
  const histories = useAtomValue(historiesAtom(symbol))
  const ranges = useMemo(
    () =>
      HISTORY_RANGES.map(({ id, label, description }, index): PortfolioRange => ({
        id: label,
        description,
        points: Option.getOrElse(AsyncResult.value(histories[index]!), () => []).map((point) => ({
          value: priceDollars(point.price),
          label: id === "1D" ?
            formatTime(DateTime.toDateUtc(point.at), { timeZone: MARKET_TIME_ZONE }) :
            formatDate(DateTime.toDateUtc(point.at), { time: false })
        }))
      })),
    [histories]
  )
  return (
    <PortfolioChart
      ranges={ranges}
      defaultRange="1D"
      title="Price"
      loading={histories.some(AsyncResult.isInitial)}
    />
  )
}
