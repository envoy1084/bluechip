import type { Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatRelative } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { bpsPercent, priceDollars } from "../../../../market/amounts.ts"
import { PriceStatusNote } from "../../../../market/PriceStatusNote.tsx"

/** The stock's current price, how it moved over 24 hours, and how fresh the Chainlink reading is. */
export function StockHeader({ stock }: Readonly<{ stock: Stock }>) {
  const { price } = stock
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <TickerChip symbol={stock.symbol} size="lg" />
      <div className="grid gap-1">
        <span className="text-label-sm text-g-500">{stock.name}</span>
        {price === null ?
          <b className="text-title-1 font-semibold text-g-500">No price right now</b> :
          (
            <Price
              price={priceDollars(price.price)}
              {...(stock.change24h === null ? {} : { change: bpsPercent(stock.change24h) })}
              size="xl"
            />
          )}
        {price === null ?
          null :
          (
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-label-sm text-g-500">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="shield" size={14} />
                Chainlink price · updated {formatRelative(DateTime.toDateUtc(price.updatedAt))}
              </span>
              <PriceStatusNote status={price.status} />
            </span>
          )}
      </div>
    </div>
  )
}
