import type { PriceStatus, Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatRelative } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { bpsPercent, priceDollars } from "../../../../market/amounts.ts"
import { useAfterHours } from "../../../../market/marketState.ts"

const STATUS_PILL: Readonly<Record<PriceStatus, { label: string; icon: IconName; className: string }>> = {
  live: {
    label: "Live price",
    icon: "check-circle",
    className: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]"
  },
  closed: {
    label: "Last close",
    icon: "moon",
    className: "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
  },
  stale: {
    label: "Not updating",
    icon: "warning",
    className: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
  }
}

// A live price while the market is closed: the 24/5 feed keeps moving overnight.
const AFTER_HOURS_PILL = {
  label: "After hours",
  icon: "moon",
  className: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]"
} as const

/** Who the stock is, its current price and 24-hour move, and how fresh the Chainlink reading behind it is. */
export function StockHeader({ stock }: Readonly<{ stock: Stock }>) {
  const { price } = stock
  const afterHours = useAfterHours()
  const pill = price === null ?
    undefined :
    price.status === "live" && afterHours ?
    AFTER_HOURS_PILL :
    STATUS_PILL[price.status]
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-4">
        <TickerChip symbol={stock.symbol} size="lg" />
        <div className="grid min-w-0 gap-0.5">
          <span className="text-label-sm text-g-500">{stock.name} · on Base</span>
          {price === null ?
            <b className="text-title-1 font-semibold text-g-500">No price right now</b> :
            (
              <Price
                price={priceDollars(price.price)}
                {...(stock.change24h === null ? {} : { change: bpsPercent(stock.change24h) })}
                size="xl"
                className="max-sm:[&_[data-slot=price-value]]:text-[36px]"
              />
            )}
        </div>
      </div>
      {price === null || pill === undefined ?
        null :
        (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-label text-g-600">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="shield" size={14} className="text-g-400" />
              Chainlink price · updated {formatRelative(DateTime.toDateUtc(price.updatedAt)).toLowerCase()}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-[5px] rounded-full px-2 py-0.5 text-caption font-semibold",
                pill.className
              )}
            >
              <Icon name={pill.icon} size={13} />
              {pill.label}
            </span>
          </p>
        )}
    </div>
  )
}
