// The preview world's market slice: the market's prices and settings, and the account's money, trades, intents and
// transfers, made up from the cast (see `market/` for each part).
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Cast } from "./cast.ts"
import { makeHistory } from "./market/history.ts"
import type { MarketSlice } from "./market/model.ts"
import { livePrices, makePriceBook } from "./market/prices.ts"
import { addStories } from "./market/stories.ts"

export type { MarketSlice } from "./market/model.ts"

export const makeMarket = (cast: Cast, now: Date): MarketSlice => {
  const at = now.getTime()
  const book = makePriceBook(cast, at)
  const prices = livePrices("mixed", at)
  const history = makeHistory(cast, at, book, prices)

  const market: MarketSlice = {
    session: "regular",
    feeds: "live",
    move: "mixed",
    apart: "none",
    missingPrice: false,
    ticking: true,
    book,
    prices,
    cash: BigInt(Math.round(cast.cash * 1_000_000)),
    holdings: new Map<StockSymbol, bigint>(
      cast.holdings.map((holding) => [holding.symbol, BigInt(Math.round(holding.shares * 100_000_000))])
    ),
    trades: history.trades,
    intents: history.intents,
    transfers: history.transfers,
    adjustments: [],
    requests: new Map(),
    nextId: history.nextId
  }

  addStories({ cast, market }, at)
  return market
}
