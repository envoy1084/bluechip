import type { Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { bpsPercent, priceDollars } from "../../../../lib/amounts.ts"
import { dayHistoryAtom } from "../../../../market/historyAtoms.ts"
import { ReferenceGap } from "../../../../market/ReferenceGap.tsx"
import { SessionNote } from "../../../../market/SessionNote.tsx"

/** The stock's past day as a sparkline; an empty slot of the same size until it loads or when there is too little. */
function DaySparkline({ stock }: Readonly<{ stock: Stock }>) {
  const history = useAtomValue(dayHistoryAtom(stock.symbol))
  const values = AsyncResult.isSuccess(history) ? history.value.map((point) => priceDollars(point.price)) : []
  if (values.length < 2) return <span aria-hidden className="hidden h-7 w-[88px] sm:block" />
  return <Sparkline values={values} width={88} height={28} className="hidden sm:block" label="Past day" />
}

/**
 * One stock in the list: who it is, whether it trades now, how far Chainlink's price is, its day, its price and change,
 * and a link to its page.
 */
export function StockListRow({ stock }: Readonly<{ stock: Stock }>) {
  return (
    <Link
      to="/stocks/$symbol"
      params={{ symbol: stock.symbol }}
      className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-g-100 bg-white px-4 py-[11px] transition-colors duration-fast ease-brand last:border-b-0 hover:bg-[#fafbfc] focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none sm:grid-cols-[60px_minmax(0,1fr)_88px_112px]"
    >
      <TickerChip symbol={stock.symbol} className="justify-self-start" />
      <span className="grid min-w-0 gap-px">
        <b className="truncate text-body-sm font-[550]">{stock.name}</b>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-px">
          {stock.price === null ? null : <SessionNote price={stock.price} />}
          <ReferenceGap stock={stock} />
        </span>
      </span>
      <DaySparkline stock={stock} />
      <span className="flex justify-end">
        {stock.price === null ?
          <span className="text-label-sm text-g-500">No price</span> :
          (
            <Price
              price={priceDollars(stock.price.price)}
              {...(stock.change24h === null ? {} : { change: bpsPercent(stock.change24h) })}
              size="sm"
              layout="stacked"
            />
          )}
      </span>
    </Link>
  )
}
