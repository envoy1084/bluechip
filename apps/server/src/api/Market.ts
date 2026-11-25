import { stocks } from "@bluechip/chain/Contracts"
import { BluechipApi } from "@bluechip/domain/Api"
import type { Address } from "@bluechip/domain/Ids"
import { Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { pricesAt, readHistory } from "../market/History.ts"
import { PriceFeed } from "../market/PriceFeed.ts"
import { quote } from "../market/Quoter.ts"

export const MarketHandlers = HttpApiBuilder.group(BluechipApi, "market", (handlers) =>
  handlers
    .handle("status", () =>
      Effect.gen(function*() {
        const feed = yield* PriceFeed
        return (yield* feed.snapshot).status
      }))
    .handle("stocks", () =>
      Effect.gen(function*() {
        const feed = yield* PriceFeed
        const snapshot = yield* feed.snapshot
        const dayAgo = yield* pricesAt(DateTime.subtract(snapshot.status.asOf, { hours: 24 }))
        return stocks.map((stock) => {
          const symbol = stock.symbol as StockSymbol
          const price = snapshot.prices.get(symbol) ?? null
          const before = dayAgo.get(symbol)
          return new Stock({
            symbol,
            name: stock.name,
            token: stock.token as Address,
            tradable: stock.pool !== null,
            logoUrl: stock.logoUrl,
            price,
            change24h: price === null || before === undefined ? null : bpsBetween(price.price, before)
          })
        })
      }))
    .handle("history", ({ params, query }) =>
      Effect.gen(function*() {
        const feed = yield* PriceFeed
        const { status } = yield* feed.snapshot
        return yield* readHistory(params.symbol, query.range, status.asOf)
      }))
    .handle("quote", ({ payload }) =>
      quote(
        "usdc" in payload.amount
          ? { symbol: payload.symbol, side: "buy", usdc: payload.amount.usdc }
          : { symbol: payload.symbol, side: "sell", shares: payload.amount.shares }
      )))
