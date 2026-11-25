import { stocks } from "@bluechip/chain/Contracts"
import type { Address } from "@bluechip/domain/Ids"
import { Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { MarketPrices } from "./MarketPrices.ts"
import { ReferencePrices } from "./ReferencePrices.ts"

/** Every stock bluechip lists, with its market price and Chainlink's, for the market page and the assistant. */
export class Stocks extends Context.Service<Stocks, {
  readonly list: Effect.Effect<ReadonlyArray<Stock>>
}>()("@bluechip/server/Stocks") {
  static readonly layer = Layer.effect(
    Stocks,
    Effect.gen(function*() {
      const market = yield* MarketPrices
      const references = yield* ReferencePrices

      const list = Effect.gen(function*() {
        const prices = yield* market.prices
        // The list still works when the chain doesn't answer; only the reference line goes missing.
        const referenceOf = yield* references.all.pipe(Effect.orElseSucceed(() => new Map()))

        return stocks.map((stock) => {
          const symbol = stock.symbol as StockSymbol
          const price = prices.get(symbol) ?? null

          return new Stock({
            symbol,
            name: stock.name,
            token: stock.token as Address,
            tradable: stock.pool !== null,
            logoUrl: stock.logoUrl,
            price,
            reference: referenceOf.get(symbol) ?? null,
            change24h: price?.previousClose == null ? null : bpsBetween(price.price, price.previousClose)
          })
        })
      }).pipe(Effect.withSpan("Stocks.list"))

      return Stocks.of({ list })
    })
  )
}
