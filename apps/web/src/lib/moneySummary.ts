// The portfolio as the money summary reads it: dollars, today's move, and each holding with its name.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import type { PortfolioSummaryProps } from "@bluechip/ui/bluechip/portfolio-summary"
import { usdcDollars } from "./amounts.ts"

/** What `PortfolioSummary` shows of a portfolio; today's move in percent is of what it was worth before it. */
export const moneySummary = (
  portfolio: Pick<Portfolio, "value" | "cash" | "change24h" | "holdings">,
  nameOf: (symbol: StockSymbol) => string
): Omit<PortfolioSummaryProps, "addCash" | "className"> => {
  const value = usdcDollars(portfolio.value)
  const dayChange = usdcDollars(portfolio.change24h)
  const before = value - dayChange

  return {
    value,
    dayChange,
    dayChangePercent: before === 0 ? 0 : (dayChange / before) * 100,
    cash: usdcDollars(portfolio.cash),
    positions: portfolio.holdings.map((holding) => ({
      symbol: holding.symbol,
      name: nameOf(holding.symbol),
      value: usdcDollars(holding.value)
    }))
  }
}
