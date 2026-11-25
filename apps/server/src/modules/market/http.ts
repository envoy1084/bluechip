import { stocks } from "@bluechip/chain/Contracts"
import { BluechipApi } from "@bluechip/domain/Api"
import type { Address } from "@bluechip/domain/Ids"
import { Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { marketStatus } from "./Calendar.ts"
import { Charts } from "./Charts.ts"
import { MarketPrices } from "./MarketPrices.ts"
import { Quoter } from "./Quoter.ts"
import { ReferencePrices } from "./ReferencePrices.ts"

export const MarketHandlers = HttpApiBuilder.group(
  BluechipApi,
  "market",
  Effect.fn(function*(handlers) {
    const market = yield* MarketPrices
    const references = yield* ReferencePrices
    const charts = yield* Charts
    const quoter = yield* Quoter

    return handlers.handleAll({
      status: () => Effect.map(DateTime.now, marketStatus),
      stocks: Effect.fn(function*() {
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
      }),
      history: ({ params, query }) => charts.history(params.symbol, query.range),
      quote: ({ payload }) =>
        quoter.quote(
          "usdc" in payload.amount
            ? { symbol: payload.symbol, side: "buy", usdc: payload.amount.usdc }
            : { symbol: payload.symbol, side: "sell", shares: payload.amount.shares }
        )
    })
  })
)
