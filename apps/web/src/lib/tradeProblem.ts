import { InsufficientCash, InsufficientShares, PriceCheckFailed, QuoteUnavailable } from "@bluechip/domain/Errors"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { bpsPercent, shareCount, usdcDollars } from "./amounts.ts"

/** Why a trade didn't start, in words: nothing moved in any of these. */
export const tradeProblem = (error: unknown, side: "buy" | "sell"): string => {
  const nothing = side === "buy" ? "Nothing was bought." : "Nothing was sold."
  if (error instanceof InsufficientCash) return `You have ${formatMoney(usdcDollars(error.available))} in cash.`
  if (error instanceof InsufficientShares) return `You have ${formatShareCount(shareCount(error.available))} to sell.`
  if (error instanceof QuoteUnavailable) {
    return error.reason === "belowMinimum" ?
      `The smallest trade is $1. ${nothing}` :
      `We couldn't get a price from the pool. ${nothing}`
  }
  if (error instanceof PriceCheckFailed) {
    return error.reason === "stale" ?
      `Chainlink's price isn't updating, so there's nothing to check the trade against. ${nothing}` :
      `The pool's price is ${bpsPercent(error.gapBps).toFixed(2)}% off Chainlink's, more than the ${
        bpsPercent(error.limitBps)
      }% allowed. ${nothing}`
  }
  return `Face ID was cancelled or the trade couldn't be sent. ${nothing}`
}
