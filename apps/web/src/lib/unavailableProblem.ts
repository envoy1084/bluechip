import type { Unavailable } from "@bluechip/domain/Errors"

/** Why Base couldn't take a request, in words: the account's missing ETH for the fee, or Base not answering. */
export const unavailableProblem = (error: Unavailable): string =>
  error.dependency === "gas" ?
    "Your account has no ETH to pay Base's network fee. Send a little ETH on Base to your account's address, then try again. Nothing changed." :
    "We couldn't reach Base just now. Nothing changed, so try again in a moment."
