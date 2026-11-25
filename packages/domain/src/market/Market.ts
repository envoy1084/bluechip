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
 * Whether the US market (NYSE hours) is open, why not, and when that changes.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class MarketStatus extends Schema.Class<MarketStatus>("@bluechip/domain/market/Market/MarketStatus")({
  state: Schema.Literals(["open", "closed"]),
  /** Why it's closed. */
  reason: Schema.NullOr(Schema.Literals(["weekend", "holiday", "beforeOpen", "afterClose"])),
  /** The next open, while closed. */
  opensAt: Schema.NullOr(Schema.DateTimeUtc),
  /** Today's close (early on some holiday eves), while open. */
  closesAt: Schema.NullOr(Schema.DateTimeUtc),
  /** The chain time this was worked out at. */
  asOf: Schema.DateTimeUtc
}) {}

/**
 * How much to trust a reference price: `live` while the market is open and the feed is fresh, `closed` (the last
 * close) while it's shut, `stale` when the market is open but the feed hasn't updated within its heartbeat.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const PriceStatus = Schema.Literals(["live", "closed", "stale"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceStatus = typeof PriceStatus.Type

/**
 * A stock's Chainlink reference price: what limits and fair-price checks compare trades against.
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
 * A supported stock with its current reference price (`null` when its feed couldn't be read).
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
  price: Schema.NullOr(ReferencePrice),
  /** The price change since about 24 hours earlier, when history reaches that far. */
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
