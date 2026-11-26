// Stocks named as the server names them in sentences: from the chain's list of Coinbase stocks.
import { stocks } from "@bluechip/chain/Contracts"
import type { StockSymbol } from "@bluechip/domain/market/Market"

/** The stock's name ("Apple"), or its symbol when the list doesn't have it. */
export const stockName = (symbol: StockSymbol): string =>
  stocks.find((stock) => stock.symbol === symbol)?.name ?? symbol
