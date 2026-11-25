import { ChainClient } from "@bluechip/chain/ChainClient"
import type { ChainError } from "@bluechip/chain/ChainError"
import { readPrices } from "@bluechip/chain/market/Prices"
import { ReferencePrice, type StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import * as Cache from "effect/Cache"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { marketStatus, priceStatus } from "./Calendar.ts"

/**
 * Every stock's Chainlink price, read on demand and shared for 15 seconds: one multicall serves every quote and page
 * view in that window, and nothing is read while nobody asks. Statuses follow the chain's own clock, which keeps a
 * pinned local fork consistent with the prices it has.
 */
export class ReferencePrices extends Context.Service<ReferencePrices, {
  readonly all: Effect.Effect<ReadonlyMap<StockSymbol, ReferencePrice>, ChainError>
}>()("@bluechip/server/ReferencePrices") {
  static readonly make = Effect.fnUntraced(function*(options: { readonly timeToLive: Duration.Input }) {
    const chain = yield* ChainClient

    const read = Effect.gen(function*() {
      const { asOf, prices } = yield* readPrices(chain)
      const status = marketStatus(DateTime.makeUnsafe(asOf))

      return new Map(prices.map((feed) => {
        const updatedAt = DateTime.makeUnsafe(feed.updatedAt)
        const symbol = feed.stock.symbol as StockSymbol
        return [
          symbol,
          new ReferencePrice({
            symbol,
            price: Price.make(feed.price),
            updatedAt,
            status: priceStatus(status, updatedAt)
          })
        ]
      }))
    })

    const cache = yield* Cache.make({ lookup: (_: "all") => read, capacity: 1, timeToLive: options.timeToLive })
    return ReferencePrices.of({ all: Cache.get(cache, "all") })
  })

  static readonly layer = Layer.effect(ReferencePrices, ReferencePrices.make({ timeToLive: "15 seconds" }))

  /** Every read from the chain, for tests that move its clock or prices and read them back at once. */
  static readonly layerUncached = Layer.effect(ReferencePrices, ReferencePrices.make({ timeToLive: 0 }))
}
