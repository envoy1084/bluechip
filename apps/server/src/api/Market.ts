import { stocks } from "@bluechip/chain/Contracts"
import { BluechipApi } from "@bluechip/domain/Api"
import type { Address } from "@bluechip/domain/Ids"
import { Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { marketStatus } from "../market/Calendar.ts"
import { Charts } from "../market/Charts.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { quote } from "../market/Quoter.ts"
import { ReferencePrices } from "../market/ReferencePrices.ts"

export const MarketHandlers = HttpApiBuilder.group(BluechipApi, "market", (handlers) =>
  handlers
    .handle("status", () => Effect.map(DateTime.now, marketStatus))
    .handle("stocks", () =>
      Effect.gen(function*() {
        const market = yield* MarketPrices
        const prices = yield* market.prices
        // The list still works when the chain doesn't answer; only the reference line goes missing.
        const references = yield* (yield* ReferencePrices).all.pipe(Effect.orElseSucceed(() => new Map()))

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
            reference: references.get(symbol) ?? null,
            change24h: price?.previousClose == null ? null : bpsBetween(price.price, price.previousClose)
          })
        })
      }))
    .handle("history", ({ params, query }) =>
      Effect.gen(function*() {
        const charts = yield* Charts
        return yield* charts.history(params.symbol, query.range)
      }))
    .handle("quote", ({ payload }) =>
      quote(
        "usdc" in payload.amount
          ? { symbol: payload.symbol, side: "buy", usdc: payload.amount.usdc }
          : { symbol: payload.symbol, side: "sell", shares: payload.amount.shares }
      )))
