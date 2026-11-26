// The market and the account as the API shows them now: the session, each stock's market and Chainlink prices, and
// the portfolio valued at market prices, with its value over the last 30 days.
import { LiveEvent } from "@bluechip/domain/Events"
import type { Address } from "@bluechip/domain/Ids"
import { MarketPrice, MarketStatus, ReferencePrice, Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, bpsBetween, Shares, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { Holding, Portfolio, PortfolioPoint } from "@bluechip/domain/portfolio/Portfolio"
import type { MarketSlice } from "./model.ts"
import { LISTINGS, priceAt, toPrice } from "./prices.ts"
import { utc } from "./records.ts"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** The session the panel set, with times counted from `now` as a real day would have them. */
export const marketStatusOf = (market: MarketSlice, now: number): MarketStatus => {
  const at = (minutes: number) => utc(Math.floor(now / MINUTE) * MINUTE + minutes * MINUTE)
  const asOf = utc(now)

  switch (market.session) {
    case "regular":
      return new MarketStatus({
        session: "regular",
        pausedFor: null,
        changesAt: at(262),
        opensAt: at(-128),
        closesAt: at(262),
        asOf
      })
    case "preMarket":
      return new MarketStatus({
        session: "preMarket",
        pausedFor: null,
        changesAt: at(75),
        opensAt: at(75),
        closesAt: null,
        asOf
      })
    case "afterHours":
      return new MarketStatus({
        session: "afterHours",
        pausedFor: null,
        changesAt: at(118),
        opensAt: at(928),
        closesAt: null,
        asOf
      })
    case "overnight":
      return new MarketStatus({
        session: "overnight",
        pausedFor: null,
        changesAt: at(300),
        opensAt: at(630),
        closesAt: null,
        asOf
      })
    case "weekend":
      return new MarketStatus({
        session: "paused",
        pausedFor: "weekend",
        changesAt: at(1_810),
        opensAt: at(2_620),
        closesAt: null,
        asOf
      })
    case "holiday":
      return new MarketStatus({
        session: "paused",
        pausedFor: "holiday",
        changesAt: at(480),
        opensAt: at(1_290),
        closesAt: null,
        asOf
      })
  }
}

const isPaused = (market: MarketSlice) => market.session === "weekend" || market.session === "holiday"

const hasPrice = (market: MarketSlice, symbol: StockSymbol) => !(market.missingPrice && symbol === "SPCX")

/** A stock's market price, `null` when the panel took it away. */
export const marketPriceOf = (market: MarketSlice, symbol: StockSymbol, now: number): MarketPrice | null => {
  const live = market.prices.get(symbol)
  if (live === undefined || !hasPrice(market, symbol)) return null

  const apart = market.apart === "market" ? 1.017 : 1
  return new MarketPrice({
    symbol,
    price: toPrice(live.price * apart),
    tradedAt: utc(isPaused(market) ? now - 20 * HOUR : live.tradedAt),
    previousClose: toPrice(live.previousClose * apart)
  })
}

/** Chainlink's price of a stock, as the feeds answer now. */
export const referenceOf = (market: MarketSlice, symbol: StockSymbol, now: number): ReferencePrice | null => {
  const live = market.prices.get(symbol)
  if (live === undefined || !hasPrice(market, symbol)) return null

  const updatedAt = market.feeds === "live" ? live.referenceAt : now - (market.feeds === "paused" ? 20 : 31) * HOUR
  return new ReferencePrice({ symbol, price: toPrice(live.reference), updatedAt: utc(updatedAt), status: market.feeds })
}

/** Every listed stock with its prices. */
export const stocksOf = (market: MarketSlice, now: number): ReadonlyArray<Stock> =>
  LISTINGS.map((listing) => {
    const price = marketPriceOf(market, listing.symbol, now)
    return new Stock({
      symbol: listing.symbol,
      name: listing.name,
      token: listing.token as Address,
      tradable: true,
      logoUrl: listing.logoUrl,
      price,
      reference: referenceOf(market, listing.symbol, now),
      change24h: price?.previousClose == null ? null : bpsBetween(price.price, price.previousClose)
    })
  })

/** The account's cash and holdings at market prices, biggest holding first. */
export const portfolioOf = (market: MarketSlice, now: number): Portfolio => {
  const held = [...market.holdings].filter(([, shares]) => shares > BigInt(0)).map(([symbol, units]) => {
    const shares = Shares.make(units)
    const price = marketPriceOf(market, symbol, now)
    return { symbol, shares, price, value: price === null ? Usdc.make(BigInt(0)) : valueOf(shares, price.price) }
  })
  const invested = held.reduce((sum, holding) => sum + holding.value, BigInt(0))
  const value = market.cash + invested
  const change24h = held.reduce(
    (sum, { price, shares, value }) =>
      price?.previousClose == null ? sum : sum + value - valueOf(shares, price.previousClose),
    BigInt(0)
  )

  return new Portfolio({
    cash: Usdc.make(market.cash),
    invested: Usdc.make(invested),
    value: Usdc.make(value),
    holdings: held.sort((a, b) => Number(b.value - a.value)).map((holding) =>
      new Holding({
        ...holding,
        weightBps: Bps.make(value === BigInt(0) ? 0 : Number((holding.value * BigInt(10_000)) / value)),
        change24h: holding.price?.previousClose == null ?
          null :
          bpsBetween(holding.price.price, holding.price.previousClose)
      })
    ),
    change24h,
    asOf: utc(now)
  })
}

/** What moved the account's money, oldest first: transfers, fills and reconciled shares. */
const movesOf = (market: MarketSlice) =>
  [
    ...market.transfers.filter((transfer) => transfer.status === "confirmed" && transfer.asset === "USDC").map((
      transfer
    ) => ({
      at: transfer.createdAt.epochMilliseconds,
      cash: transfer.kind === "deposit" ? transfer.amount : -transfer.amount,
      symbol: null,
      shares: BigInt(0)
    })),
    ...market.trades.filter(({ trade }) => trade.status === "filled").map(({ trade }) => ({
      at: trade.settledAt?.epochMilliseconds ?? trade.createdAt.epochMilliseconds,
      cash: trade.side === "buy" ? -trade.usdc : trade.usdc,
      symbol: trade.symbol,
      shares: trade.side === "buy" ? trade.shares : -trade.shares
    })),
    ...market.adjustments.map((adjustment) => ({
      at: adjustment.at,
      cash: BigInt(0),
      symbol: adjustment.symbol,
      shares: adjustment.shares
    }))
  ].sort((a, b) => a.at - b.at)

/** The portfolio's value every 4 hours over the last 30 days (from its first deposit), then now. */
export const portfolioHistoryOf = (market: MarketSlice, now: number): ReadonlyArray<PortfolioPoint> => {
  const moves = movesOf(market)
  if (moves.length === 0) return []

  const step = 4 * HOUR
  const from = Math.max(now - 30 * 24 * HOUR, Math.ceil(moves[0]!.at / step) * step)
  const shares = new Map<StockSymbol, bigint>()
  let cash = BigInt(0)
  let next = 0
  const points: Array<PortfolioPoint> = []

  for (let at = from; at < now; at += step) {
    while (next < moves.length && moves[next]!.at <= at) {
      const move = moves[next++]!
      cash += move.cash
      if (move.symbol !== null) shares.set(move.symbol, (shares.get(move.symbol) ?? BigInt(0)) + move.shares)
    }
    let value = cash
    for (const [symbol, units] of shares) {
      value += valueOf(Shares.make(units), toPrice(priceAt(market.book, market.prices.get(symbol)!, at)))
    }
    points.push(new PortfolioPoint({ at: utc(at), value: Usdc.make(value < BigInt(0) ? BigInt(0) : value) }))
  }

  points.push(new PortfolioPoint({ at: utc(now), value: portfolioOf(market, now).value }))
  return points
}

/**
 * Moves a few prices a little, as the market's feed would between two ticks (Chainlink follows), and returns the
 * `PriceTick` that tells the app; nothing while prices are paused.
 */
export const tickPrices = (market: MarketSlice, now: number, random: () => number = Math.random) => {
  if (isPaused(market) || market.feeds !== "live") return []

  const symbols = [...market.prices.keys()].filter(() => random() < 0.35)
  for (const symbol of symbols) {
    const live = market.prices.get(symbol)!
    live.price *= 1 + (random() - 0.5) * 0.003
    live.tradedAt = now
    live.reference = live.price * (1 + (random() - 0.5) * 0.0008)
    live.referenceAt = now
  }

  const prices = symbols.flatMap((symbol) => {
    const price = marketPriceOf(market, symbol, now)
    return price === null ? [] : [price]
  })
  return prices.length === 0 ? [] : [LiveEvent.cases.PriceTick.make({ prices })]
}
