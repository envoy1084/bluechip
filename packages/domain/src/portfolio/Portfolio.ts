/**
 * What a user owns: cash (USDC) and stocks, valued at reference prices.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { MarketPrice, StockSymbol } from "../market/Market.ts"
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
  /** `null` while the stock has no market price; the holding is then valued at zero. */
  price: Schema.NullOr(MarketPrice),
  value: Usdc,
  /** Its share of the portfolio's value (cash included). */
  weightBps: Bps,
  /** The market price against the previous close. */
  change24h: Schema.NullOr(Bps)
}) {}

/**
 * The user's money: cash, stocks and their total, from the account's balances on chain at market prices.
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
  /** What price moves since the previous close did to the stocks held now (USDC base units; negative when down). */
  change24h: Schema.BigInt,
  asOf: Schema.DateTimeUtc
}) {}

/**
 * The portfolio's value at a moment, for its 30-day chart (a snapshot every 4 hours, plus now).
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
