/**
 * The US stock market as bluechip sees it: whether it is open, each stock's reference price, history and quotes.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Address } from "../Ids.ts"
import { Bps, Price, Shares, Usdc } from "./Units.ts"

/**
 * The stocks bluechip supports: every Coinbase tokenized stock on Base with a Chainlink price feed and a pool.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const StockSymbol = Schema.Literals([
  "AAPL",
  "AMZN",
  "ANT",
  "CRCL",
  "GOOGL",
  "INTC",
  "META",
  "MSFT",
  "MSTR",
  "NVDA",
  "SNDK",
  "SPCX",
  "TSLA"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type StockSymbol = typeof StockSymbol.Type

/**
 * Where the US market's trading day stands. The stock tokens trade around the clock; this is about prices:
 * `regular`, `preMarket`, `afterHours` and `overnight` prices keep moving (Sunday 8 pm to Friday 8 pm New York),
 * `paused` ones don't (weekends and NYSE holidays), so a pool can drift from the last price.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const MarketSession = Schema.Literals(["regular", "preMarket", "afterHours", "overnight", "paused"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type MarketSession = typeof MarketSession.Type

/**
 * The market's session now, when the next one starts and when regular trading next opens.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class MarketStatus extends Schema.Class<MarketStatus>("@bluechip/domain/market/Market/MarketStatus")({
  session: MarketSession,
  /** Why prices are paused. */
  pausedFor: Schema.NullOr(Schema.Literals(["weekend", "holiday"])),
  changesAt: Schema.DateTimeUtc,
  /** Today's open while regular trading is on, otherwise the next one. */
  opensAt: Schema.DateTimeUtc,
  /** Today's close (early on some holiday eves) while regular trading is on. */
  closesAt: Schema.NullOr(Schema.DateTimeUtc),
  asOf: Schema.DateTimeUtc
}) {}

/**
 * How much to trust a Chainlink reference price: `live` while the feed updates, `paused` on weekends and holidays
 * (the last price before the pause), `stale` when it missed its 24-hour heartbeat.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PriceStatus = Schema.Literals(["live", "paused", "stale"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceStatus = typeof PriceStatus.Type

/**
 * A stock's Chainlink price per token: what quotes and limits compare trades against.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class ReferencePrice extends Schema.Class<ReferencePrice>("@bluechip/domain/market/Market/ReferencePrice")({
  symbol: StockSymbol,
  price: Price,
  updatedAt: Schema.DateTimeUtc,
  status: PriceStatus
}) {}

/**
 * A stock's market price per token: its last trade on the stock market (Alpaca's IEX feed) times the token's
 * multiplier, with the previous session's close for the daily change.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class MarketPrice extends Schema.Class<MarketPrice>("@bluechip/domain/market/Market/MarketPrice")({
  symbol: StockSymbol,
  price: Price,
  tradedAt: Schema.DateTimeUtc,
  previousClose: Schema.NullOr(Price)
}) {}

/**
 * A supported stock with its market price, Chainlink reference and daily change (each `null` when unavailable).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Stock extends Schema.Class<Stock>("@bluechip/domain/market/Market/Stock")({
  symbol: StockSymbol,
  name: Schema.String,
  /** The token's address on Base. */
  token: Address,
  /** Whether it has a pool to trade in. */
  tradable: Schema.Boolean,
  /** The company's logo (published by Coinbase), when there is one. */
  logoUrl: Schema.NullOr(Schema.String),
  price: Schema.NullOr(MarketPrice),
  reference: Schema.NullOr(ReferencePrice),
  /** The market price against the previous close. */
  change24h: Schema.NullOr(Bps)
}) {}

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const HistoryRange = Schema.Literals(["1D", "1W", "1M", "3M", "ALL"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type HistoryRange = typeof HistoryRange.Type

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PricePoint extends Schema.Class<PricePoint>("@bluechip/domain/market/Market/PricePoint")({
  at: Schema.DateTimeUtc,
  price: Price
}) {}

/**
 * What a trade would do right now in the stock's Aerodrome pool. Buying spends USDC for shares, selling the reverse.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Quote extends Schema.Class<Quote>("@bluechip/domain/market/Market/Quote")({
  symbol: StockSymbol,
  side: Schema.Literals(["buy", "sell"]),
  usdc: Usdc,
  shares: Shares,
  /** The price per share this trade gets. */
  price: Price,
  /** The Chainlink price it is compared with. */
  reference: ReferencePrice,
  /** How much worse than the reference price, in basis points (positive is worse for you). */
  gapBps: Schema.Int,
  /** The least the trade may return at the default 0.5% slippage. */
  minimumOut: Schema.BigInt,
  pool: Address,
  quotedAt: Schema.DateTimeUtc,
  /** Prices move; a quote is shown as current for a short while only. */
  expiresAt: Schema.DateTimeUtc
}) {}
