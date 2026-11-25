import type { MarketPrice, StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, bpsBetween, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Holding, Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../lib/api/client.ts"
import { livePricesAtom } from "../lib/api/events.ts"

const reactivityKeys = [portfolioReactivityKey, liveReactivityKey]

/** The portfolio as the server last valued it; refresh it to read the account's balances again. */
export const fetchedPortfolioAtom = BluechipApiClient.query("portfolio", "portfolio", { reactivityKeys })

/** Holdings revalued at newer market prices, so the portfolio moves with every `PriceTick`. */
const revalue = (portfolio: Portfolio, live: ReadonlyMap<StockSymbol, MarketPrice>): Portfolio => {
  if (portfolio.holdings.every((holding) => !live.has(holding.symbol))) return portfolio

  const holdings = portfolio.holdings.map((holding) => {
    const price = live.get(holding.symbol) ?? holding.price
    if (price === null || price === holding.price) return holding

    return new Holding({
      ...holding,
      price,
      value: valueOf(holding.shares, price.price),
      change24h: price.previousClose === null ? holding.change24h : bpsBetween(price.price, price.previousClose)
    })
  })

  const invested = Usdc.make(holdings.reduce((sum, holding) => sum + holding.value, BigInt(0)))
  const value = Usdc.make(portfolio.cash + invested)
  const change24h = holdings.reduce((sum, holding) => {
    const close = holding.price?.previousClose
    return close == null ? sum : sum + holding.value - valueOf(holding.shares, close)
  }, BigInt(0))

  return new Portfolio({
    ...portfolio,
    invested,
    value,
    change24h,
    holdings: holdings.map((holding) =>
      new Holding({
        ...holding,
        weightBps: Bps.make(value === BigInt(0) ? 0 : Number((holding.value * BigInt(10_000)) / value))
      })
    )
  })
}

/** The signed-in user's cash and holdings at live market prices; refetched when their balances change. */
export const portfolioAtom = Atom.make((get) =>
  AsyncResult.map(get(fetchedPortfolioAtom), (portfolio) => revalue(portfolio, get(livePricesAtom)))
)

/** The portfolio's value every 4 hours over the last 30 days, ending now. */
export const portfolioHistoryAtom = BluechipApiClient.query("portfolio", "history", { reactivityKeys })

/** The latest withdrawals, newest first. */
export const withdrawalsAtom = BluechipApiClient.query("transfers", "list", {
  query: { pageSize: 10 },
  reactivityKeys
})
