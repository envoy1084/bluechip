import { BluechipApiClient, portfolioReactivityKey } from "../lib/api/client.ts"

/** What the signed-in account can still get from the faucet today (only where money is pretend). */
export const faucetAllowanceAtom = BluechipApiClient.query("faucet", "allowance", {
  reactivityKeys: [portfolioReactivityKey]
})

/** Test USDC for the signed-in account, from its daily allowance; refreshes the portfolio and the allowance. */
export const claimTestMoneyAtom = BluechipApiClient.mutation("faucet", "claim")
