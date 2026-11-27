import { type MarketPrice, StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, bpsBetween, Shares, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Holding, Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import type * as DateTime from "effect/DateTime"
import type { Holdings } from "./AccountBalances.ts"

const zero = BigInt(0)

/**
 * Values holdings at market prices: cash, each stock held (biggest first, with its share of the total) and what price
 * moves since the previous close did to them. A stock without a price counts as zero rather than hiding the rest.
 */
export const valueHoldings = (
  holdings: Holdings,
  prices: ReadonlyMap<StockSymbol, MarketPrice>,
  asOf: DateTime.Utc
): Portfolio => {
  const cash = Usdc.make(holdings.get("USDC") ?? zero)

  const held = StockSymbol.literals.flatMap((symbol) => {
    const shares = Shares.make(holdings.get(symbol) ?? zero)
    if (shares === zero) return []

    const price = prices.get(symbol) ?? null
    const value = price === null ? Usdc.make(zero) : valueOf(shares, price.price)
    const before = price?.previousClose == null ? null : valueOf(shares, price.previousClose)

    return [{
      symbol,
      shares,
      price,
      value,
      moved: before === null ? zero : value - before,
      change24h: price?.previousClose == null ? null : bpsBetween(price.price, price.previousClose)
    }]
  })

  const invested = Usdc.make(held.reduce((sum, holding) => sum + holding.value, zero))
  const value = Usdc.make(cash + invested)
  const weight = (part: bigint) => Bps.make(value === zero ? 0 : Number((part * BigInt(10_000)) / value))

  return new Portfolio({
    cash,
    invested,
    value,
    holdings: held
      .sort((a, b) => (a.value === b.value ? 0 : a.value > b.value ? -1 : 1))
      .map(({ change24h, price, shares, symbol, value }) =>
        new Holding({ symbol, shares, price, value, weightBps: weight(value), change24h })
      ),
    change24h: held.reduce((sum, holding) => sum + holding.moved, zero),
    asOf
  })
}
