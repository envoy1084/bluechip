/**
 * Paper money's price feeds follow the market as Chainlink's equity feeds do: while US equities trade (24/5, the
 * market's sessions), a feed takes the market price once it moved 0.1% from its answer or its answer is an hour old;
 * while the market is paused, nothing is written, so feeds pause and go stale as on Base.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import type { MarketPrice, MarketSession, StockSymbol } from "../market/Market.ts"
import type { Price } from "../market/Units.ts"

/**
 * A move from the feed's answer that is written at once, in basis points: 0.1%.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEVIATION_BPS = 10

/**
 * The longest a feed's answer stands while the market trades: an hour.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const HEARTBEAT: Duration.Duration = Duration.hours(1)

/**
 * A feed's latest answer (per token, 8 decimals) and when it was written.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface FeedAnswer {
  readonly answer: Price
  readonly updatedAt: DateTime.Utc
}

/**
 * A feed to write: the stock's market price as its new answer.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface FeedUpdate {
  readonly symbol: StockSymbol
  readonly answer: Price
}

/**
 * The feeds to write now, in the order of `prices`: none while the market is paused; otherwise each stock with a
 * market price whose feed has no answer yet, moved at least {@link DEVIATION_BPS} from it, or is at least
 * {@link HEARTBEAT} old.
 *
 * **Example** (A 0.2% move)
 *
 * ```ts import.meta.vitest
 * import { feedUpdates } from "@bluechip/domain/paper/FeedUpdates"
 * import { MarketPrice } from "@bluechip/domain/market/Market"
 * import { Price } from "@bluechip/domain/market/Units"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2026-11-27T15:00:00Z")
 * const updates = feedUpdates({
 *   session: "regular",
 *   now,
 *   prices: [new MarketPrice({ symbol: "NVDA", price: Price.make(BigInt(15_030_000_000)), tradedAt: now, previousClose: null })],
 *   feeds: new Map([["NVDA", { answer: Price.make(BigInt(15_000_000_000)), updatedAt: now }]])
 * })
 * updates // [{ symbol: "NVDA", answer: 15_030_000_000n }]
 * ```
 *
 * @stability unstable
 * @category decisions
 * @since 0.0.0
 */
export const feedUpdates = (input: {
  readonly session: MarketSession
  readonly now: DateTime.Utc
  readonly prices: ReadonlyArray<MarketPrice>
  readonly feeds: ReadonlyMap<StockSymbol, FeedAnswer>
}): ReadonlyArray<FeedUpdate> => {
  if (input.session === "paused") return []

  return input.prices.flatMap((market): Array<FeedUpdate> => {
    const feed = input.feeds.get(market.symbol)
    const update = { symbol: market.symbol, answer: market.price }
    if (feed === undefined) return [update]

    const move = market.price > feed.answer ? market.price - feed.answer : feed.answer - market.price
    const moved = move * BigInt(10_000) >= feed.answer * BigInt(DEVIATION_BPS)
    const aged = Duration.isGreaterThanOrEqualTo(DateTime.distance(feed.updatedAt, input.now), HEARTBEAT)
    return moved || aged ? [update] : []
  })
}
