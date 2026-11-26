// Your holdings as home shows them: what moved most today, and your money split into a mix of a few parts.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Holding, Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import type { MixPart } from "@bluechip/ui/bluechip/mix-bar"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface Mover {
  readonly symbol: StockSymbol
  readonly value: number
  /** Today's move in percent, and in dollars on what you hold. */
  readonly percent: number
  readonly dollars: number
}

const MOVERS = 3
const MIX_PARTS = 4

/** The holdings that moved most today, either way, biggest first; those with no price today are left out. */
export const movers = (
  holdings: ReadonlyArray<Pick<Holding, "symbol" | "value" | "change24h">>
): ReadonlyArray<Mover> =>
  holdings
    .flatMap((holding) => {
      if (holding.change24h === null) return []
      const value = usdcDollars(holding.value)
      const bps = holding.change24h
      return [{ symbol: holding.symbol, value, percent: bps / 100, dollars: (value * bps) / (10_000 + bps) }]
    })
    .toSorted((a, b) => Math.abs(b.percent) - Math.abs(a.percent) || a.symbol.localeCompare(b.symbol))
    .slice(0, MOVERS)

/** Your biggest four holdings, the rest folded into Others, then cash; empty when there's no money. */
export const mixParts = (
  portfolio: Pick<Portfolio, "value" | "cash"> & {
    readonly holdings: ReadonlyArray<Pick<Holding, "symbol" | "value">>
  },
  nameOf: (symbol: StockSymbol) => string
): ReadonlyArray<MixPart> => {
  if (portfolio.value === BigInt(0)) return []

  const share = (usdc: bigint) => (usdcDollars(usdc) / usdcDollars(portfolio.value)) * 100
  const held = portfolio.holdings.filter((holding) => holding.value > BigInt(0))
    .toSorted((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0))
  const shown = held.length > MIX_PARTS + 1 ? held.slice(0, MIX_PARTS) : held
  const others = held.slice(shown.length).reduce((sum, holding) => sum + holding.value, BigInt(0))

  return [
    ...shown.map((holding) => ({ id: holding.symbol, label: nameOf(holding.symbol), percent: share(holding.value) })),
    ...(others === BigInt(0) ? [] : [{ id: "others", label: "Others", percent: share(others) }]),
    ...(portfolio.cash === BigInt(0) ? [] : [{ id: "cash", label: "Cash", percent: share(portfolio.cash) }])
  ]
}

/**
 * The mix's shares as whole percents that add up to 100, for its legend: each rounded down, then the points left over
 * go to the parts that lost most in rounding (12.5 + 12.5 + 75 reads 13 + 12 + 75, not 101).
 */
export const wholePercents = (parts: ReadonlyArray<Pick<MixPart, "percent">>): ReadonlyArray<number> => {
  const floors = parts.map((part) => Math.floor(part.percent))
  const left = Math.round(parts.reduce((sum, part) => sum + part.percent, 0)) - floors.reduce((a, b) => a + b, 0)
  const byRemainder = parts.map((part, index) => ({ index, remainder: part.percent - floors[index]! }))
    .toSorted((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder.slice(0, Math.max(0, left))) floors[index]! += 1
  return floors
}
