import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../../../lib/api/client.ts"

/** How the portfolio is doing, from the ledger; refetched when a trade fills or balances change. */
export const performanceAtom = BluechipApiClient.query("performance", "portfolio", {
  reactivityKeys: [portfolioReactivityKey, liveReactivityKey]
})
