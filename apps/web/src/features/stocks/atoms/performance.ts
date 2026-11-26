import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as Atom from "effect/reactivity/Atom"
import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../../../lib/api/client.ts"

/** Your results in one stock, from the ledger; refetched when a trade fills or balances change. */
export const stockPerformanceAtom = Atom.family((symbol: StockSymbol) =>
  BluechipApiClient.query("performance", "stock", {
    params: { symbol },
    reactivityKeys: [portfolioReactivityKey, liveReactivityKey]
  })
)
