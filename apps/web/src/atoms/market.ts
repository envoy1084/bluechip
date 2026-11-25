import { type HistoryRange, type ReferencePrice, Stock, type StockSymbol } from "@bluechip/domain/market/Market"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey } from "../api/client.ts"
import { livePricesAtom } from "../api/events.ts"

/** Whether the US market is open (NYSE regular hours), refetched after the live stream reconnects. */
export const marketStatusAtom = BluechipApiClient.query("market", "status", { reactivityKeys: [liveReactivityKey] })

const fetchedStocksAtom = BluechipApiClient.query("market", "stocks", { reactivityKeys: [liveReactivityKey] })

const newer = (fetched: ReferencePrice | null, live: ReferencePrice | undefined) =>
  live !== undefined && (fetched === null || DateTime.isGreaterThan(live.updatedAt, fetched.updatedAt) ||
      live.status !== fetched.status)
    ? live
    : fetched

/**
 * Every supported stock with its latest reference price: the fetched list, with prices replaced by newer ones from
 * `PriceTick` events as they arrive.
 */
export const stocksAtom = Atom.make((get) =>
  AsyncResult.map(get(fetchedStocksAtom), (stocks): ReadonlyArray<Stock> => {
    const live = get(livePricesAtom)
    return stocks.map((stock) => {
      const price = newer(stock.price, live.get(stock.symbol))
      return price === stock.price ? stock : new Stock({ ...stock, price })
    })
  })
)

/** One stock from {@link stocksAtom}. */
export const stockAtom = Atom.family((symbol: StockSymbol) =>
  Atom.make((get) => AsyncResult.map(get(stocksAtom), (stocks) => stocks.find((stock) => stock.symbol === symbol)))
)

/** A stock's price history over a range. */
export const historyAtom = (symbol: StockSymbol, range: HistoryRange) =>
  BluechipApiClient.query("market", "history", {
    params: { symbol },
    query: { range },
    reactivityKeys: [liveReactivityKey],
    timeToLive: "5 minutes"
  })

/** Asks for a quote; each call replaces the last. */
export const quoteAtom = BluechipApiClient.mutation("market", "quote")
