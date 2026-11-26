import type { PriceStatus, Stock } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/ui/bluechip/price-change"
import { StatusPill, type StatusTone } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { formatMoney, formatRelative } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { MarketPill } from "../../../components/MarketPill.tsx"
import { bpsPercent, priceDollars } from "../../../lib/amounts.ts"
import { referenceGap } from "./ReferenceGap.tsx"
import { SessionNote } from "./SessionNote.tsx"

const REFERENCE_PILL: Readonly<Record<PriceStatus, { label: string; icon: IconName; tone: StatusTone }>> = {
  live: { label: "Live", icon: "check-circle", tone: "positive" },
  paused: { label: "Paused", icon: "pause", tone: "neutral" },
  stale: { label: "Not updating", icon: "warning", tone: "attention" }
}

/**
 * Who the stock is, its market price and daily move, and the Chainlink price that quotes are checked against: how
 * fresh it is and how far apart the two are.
 */
export function StockHeader({ stock }: Readonly<{ stock: Stock }>) {
  const { price, reference } = stock
  const gap = referenceGap(stock)

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-4">
        <TickerChip symbol={stock.symbol} size="lg" />
        <div className="grid min-w-0 gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-500">
            {stock.name} on Base
            {price === null ? null : <SessionNote price={price} showPaused={false} onlyQuiet />}
            <MarketPill />
          </span>
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

      {reference === null ?
        null :
        (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-label text-g-600">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Icon name="shield" size={14} className="text-g-400" />
              Chainlink {formatMoney(priceDollars(reference.price))}
              {gap === null ? null : `, ${Math.abs(gap).toFixed(1)}% apart`}
              {`, updated ${formatRelative(DateTime.toDateUtc(reference.updatedAt)).toLowerCase()}`}
            </span>
            <StatusPill tone={REFERENCE_PILL[reference.status].tone} icon={REFERENCE_PILL[reference.status].icon}>
              {REFERENCE_PILL[reference.status].label}
            </StatusPill>
          </p>
        )}
    </div>
  )
}
