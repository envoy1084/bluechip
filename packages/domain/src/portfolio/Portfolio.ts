/**
 * What a user owns: cash (USDC) and stocks, valued at reference prices.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { ReferencePrice, StockSymbol } from "../market/Market.ts"
import { Bps, Shares, Usdc } from "../market/Units.ts"

/**
 * One stock the user holds, valued at its reference price.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Holding extends Schema.Class<Holding>("@bluechip/domain/portfolio/Portfolio/Holding")({
  symbol: StockSymbol,
  shares: Shares,
  /** `null` while the stock's feed can't be read; the holding is then valued at zero. */
  price: Schema.NullOr(ReferencePrice),
  value: Usdc,
  /** Its share of the portfolio's value (cash included). */
  weightBps: Bps,
  /** The price change since about 24 hours earlier, when history reaches that far. */
  change24h: Schema.NullOr(Bps)
}) {}

/**
 * The user's money: cash, stocks and their total, as of the chain's latest block the server read.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Portfolio extends Schema.Class<Portfolio>("@bluechip/domain/portfolio/Portfolio/Portfolio")({
  cash: Usdc,
  /** The stocks' value. */
  invested: Usdc,
  /** Cash plus stocks. */
  value: Usdc,
  /** Biggest holding first. */
  holdings: Schema.Array(Holding),
  /** How much the value moved over the last 24 hours (USDC base units; negative when it fell). */
  change24h: Schema.BigInt,
  asOf: Schema.DateTimeUtc
}) {}

/**
 * The portfolio's value at a moment, for its chart.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PortfolioPoint
  extends Schema.Class<PortfolioPoint>("@bluechip/domain/portfolio/Portfolio/PortfolioPoint")({
    at: Schema.DateTimeUtc,
    value: Usdc
  })
{}
