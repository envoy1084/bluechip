import type { Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { bpsPercent, priceDollars } from "../../../lib/amounts.ts"
import { dayHistoryAtom } from "../atoms/history.ts"
import { ReferenceGap } from "./ReferenceGap.tsx"

/** The stock's past day as a sparkline; an empty slot of the same size until it loads or when there is too little. */
function DaySparkline({ stock }: Readonly<{ stock: Stock }>) {
  const history = useAtomValue(dayHistoryAtom(stock.symbol))
  const values = AsyncResult.isSuccess(history) ? history.value.map((point) => priceDollars(point.price)) : []
  if (values.length < 2) return <span aria-hidden className="block h-7 w-[88px]" />
  return <Sparkline values={values} width={88} height={28} label="Past day" />
}

/**
 * One stock in the list, on the shared stock row: who it is, Chainlink's price when it's noticeably apart, its day, its
 * price and change, and a link to its page. The session is said once, by the page's market pill.
 */
export function StockListRow({ stock }: Readonly<{ stock: Stock }>) {
  return (
    <StockRow
      symbol={stock.symbol}
      name={stock.name}
      size="md"
      detail={<ReferenceGap stock={stock} quiet />}
      aside={<DaySparkline stock={stock} />}
      trailing={stock.price === null ?
        <span className="text-label-sm text-g-500">No price</span> :
        (
          <Price
            price={priceDollars(stock.price.price)}
            {...(stock.change24h === null ? {} : { change: bpsPercent(stock.change24h) })}
            size="sm"
            layout="stacked"
          />
        )}
      className="py-[11px]"
      render={<Link to="/stocks/$symbol" params={{ symbol: stock.symbol }} />}
    />
  )
}
