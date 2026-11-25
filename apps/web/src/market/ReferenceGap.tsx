import type { Stock } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import { formatMoney } from "@bluechip/ui/lib/format"
import { priceDollars } from "./amounts.ts"

/** How far the market price is from Chainlink's, in percent; `null` when either is missing. */
export const referenceGap = (stock: Stock): number | null =>
  stock.price === null || stock.reference === null ? null : bpsBetween(stock.price.price, stock.reference.price) / 100

/** "Chainlink $152.04, 0.1% apart": the price trades are checked against, next to the market's. */
export function ReferenceGap({ stock }: Readonly<{ stock: Stock }>) {
  const gap = referenceGap(stock)
  if (gap === null || stock.reference === null) return null

  return (
    <span className="text-caption text-g-500 tabular-nums">
      Chainlink {formatMoney(priceDollars(stock.reference.price))}, {Math.abs(gap).toFixed(1)}% apart
    </span>
  )
}
