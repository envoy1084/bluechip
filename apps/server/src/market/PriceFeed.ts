import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { type FeedPrice, readPrices } from "@bluechip/chain/market/Prices"
import { LiveEvent } from "@bluechip/domain/Events"
import { type MarketStatus, ReferencePrice, type StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schedule from "effect/Schedule"
import { LiveEvents } from "../live/LiveEvents.ts"
import { feedsPaused, marketStatus, priceStatus } from "./Calendar.ts"

/** The latest reference prices and market status, as of the chain's latest block. */
export interface PriceSnapshot {
  readonly status: MarketStatus
  readonly prices: ReadonlyMap<StockSymbol, ReferencePrice>
  /** The raw feed answers behind the prices (round ids, for history). */
  readonly feeds: ReadonlyArray<FeedPrice>
}

const toSnapshot = ({ asOf, prices }: { readonly asOf: Date; readonly prices: ReadonlyArray<FeedPrice> }) => {
  const status = marketStatus(DateTime.makeUnsafe(asOf))
  const references = prices.map((feed) => {
    const updatedAt = DateTime.makeUnsafe(feed.updatedAt)
    return new ReferencePrice({
      symbol: feed.stock.symbol as StockSymbol,
      price: Price.make(feed.price),
      updatedAt,
      status: priceStatus(status, updatedAt)
    })
  })
  return {
    status,
    prices: new Map(references.map((price) => [price.symbol, price])),
    feeds: prices
  } satisfies PriceSnapshot
}

const changed = (before: ReferencePrice | undefined, after: ReferencePrice) =>
  before === undefined || before.price !== after.price || before.status !== after.status ||
  !DateTime.Equivalence(before.updatedAt, after.updatedAt)

/**
 * Reference prices for every stock, kept fresh by polling the feeds (`PRICE_POLL_SECONDS`, 15 by default, not on
 * weekends and holidays) and announced as `PriceTick` live events when they change. One multicall per poll.
 */
export class PriceFeed extends Context.Service<PriceFeed, {
  readonly snapshot: Effect.Effect<PriceSnapshot>
  /** Reads the feeds now, updating the snapshot (and announcing changes). */
  readonly refresh: Effect.Effect<PriceSnapshot, ChainError>
}>()("@bluechip/server/PriceFeed") {
  static readonly layer = Layer.effect(
    PriceFeed,
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const live = yield* LiveEvents
      const every = yield* Config.Int("PRICE_POLL_SECONDS").pipe(Config.withDefault(15))
      const empty: PriceSnapshot = { status: marketStatus(yield* DateTime.now), prices: new Map(), feeds: [] }
      const current = yield* Ref.make(empty)

      const refresh = Effect.gen(function*() {
        const next = toSnapshot(yield* readPrices(chain))
        const previous = yield* Ref.getAndSet(current, next)
        const moved = [...next.prices.values()].filter((price) => changed(previous.prices.get(price.symbol), price))
        if (moved.length > 0 && previous.feeds.length > 0) {
          yield* live.publish(LiveEvent.cases.PriceTick.make({ prices: moved }))
        }
        return next
      })
      const poll = refresh.pipe(Effect.catch((error) => Effect.logWarning("Could not read prices", error)))
      // The feeds pause on weekends and holidays, so polling then only spends RPC calls on the last close.
      const pollWhileTrading = Effect.gen(function*() {
        if (!feedsPaused(yield* DateTime.now)) yield* poll
      })

      yield* poll
      yield* Effect.forkScoped(pollWhileTrading.pipe(Effect.repeat(Schedule.spaced(`${every} seconds`))))
      return { snapshot: Ref.get(current), refresh }
    })
  )
}
