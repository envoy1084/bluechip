import type { Stock } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import { formatMoney } from "@bluechip/ui/lib/format"
import { priceDollars } from "../../../lib/amounts.ts"

/** How far the market price is from Chainlink's, in percent; `null` when either is missing. */
export const referenceGap = (stock: Stock): number | null =>
  stock.price === null || stock.reference === null ? null : bpsBetween(stock.price.price, stock.reference.price) / 100

// Under this, the two prices say the same thing: a list says nothing about it.
const NOTICEABLE = 0.1

/**
 * "Chainlink $152.04, 0.3% apart": the price trades are checked against, next to the market's. `quiet` leaves it out
 * while they agree within 0.1%, as a list of stocks does.
 */
export function ReferenceGap({ stock, quiet = false }: Readonly<{ stock: Stock; quiet?: boolean }>) {
  const gap = referenceGap(stock)
  if (gap === null || stock.reference === null) return null
  if (quiet && Math.abs(gap) <= NOTICEABLE) return null

  return (
    <span className="text-caption text-g-500 tabular-nums">
      Chainlink {formatMoney(priceDollars(stock.reference.price))}, {Math.abs(gap).toFixed(1)}% apart
    </span>
  )
}
