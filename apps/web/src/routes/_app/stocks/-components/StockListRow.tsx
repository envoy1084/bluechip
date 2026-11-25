import type { Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Badge } from "@bluechip/ui/components/badge"
import { Link } from "@tanstack/react-router"
import { bpsPercent, priceDollars } from "../../../../market/amounts.ts"
import { PriceStatusNote } from "../../../../market/PriceStatusNote.tsx"

/** One stock in the list: who it is, what it costs, how it moved, and a link to its page. */
export function StockListRow({ stock }: Readonly<{ stock: Stock }>) {
  return (
    <Link
      to="/stocks/$symbol"
      params={{ symbol: stock.symbol }}
      className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-g-100 bg-white px-4 py-3 transition-colors duration-fast ease-brand last:border-b-0 hover:bg-[#fafbfc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
    >
      <TickerChip symbol={stock.symbol} size="lg" className="justify-self-start" />
      <span className="grid min-w-0 gap-0.5">
        <b className="truncate text-body-sm font-semibold">{stock.name}</b>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {stock.tradable ? null : <Badge variant="secondary">Not tradable yet</Badge>}
          {stock.price === null ? null : <PriceStatusNote status={stock.price.status} />}
        </span>
      </span>
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
    </Link>
  )
}
