import { type MarketPrice, Stock } from "@bluechip/domain/market/Market"
import { bpsBetween } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey } from "../lib/api/client.ts"
import { livePricesAtom } from "../lib/api/events.ts"

/** The US market's session (regular, extended or paused), refetched after the live stream reconnects. */
export const marketStatusAtom = BluechipApiClient.query("market", "status", { reactivityKeys: [liveReactivityKey] })

const fetchedStocksAtom = BluechipApiClient.query("market", "stocks", { reactivityKeys: [liveReactivityKey] })

const newer = (fetched: MarketPrice | null, live: MarketPrice | undefined) =>
  live !== undefined && (fetched === null || DateTime.isGreaterThan(live.tradedAt, fetched.tradedAt)) ? live : fetched

/**
 * Every supported stock with its latest market price: the fetched list, with prices replaced by newer ones from
 * `PriceTick` events as they arrive (and the daily change with them).
 */
export const stocksAtom = Atom.make((get) =>
  AsyncResult.map(get(fetchedStocksAtom), (stocks): ReadonlyArray<Stock> => {
    const live = get(livePricesAtom)
    return stocks.map((stock) => {
      const price = newer(stock.price, live.get(stock.symbol))
      if (price === stock.price || price === null) return stock

      const change24h = price.previousClose === null ? stock.change24h : bpsBetween(price.price, price.previousClose)
      return new Stock({ ...stock, price, change24h })
    })
  })
)
