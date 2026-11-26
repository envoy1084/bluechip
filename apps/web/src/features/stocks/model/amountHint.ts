import type { Quote } from "@bluechip/domain/market/Market"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { shareCount, usdcDollars } from "../../../lib/amounts.ts"

/** Where the amount stands, as the trade box knows it. */
export type AmountState =
  | { readonly _tag: "Empty"; readonly side: "buy" | "sell"; readonly symbol: string; readonly held: bigint }
  | { readonly _tag: "BelowMinimum" }
  | { readonly _tag: "OverAvailable"; readonly side: "buy" | "sell" }
  | { readonly _tag: "Quoting" }
  | { readonly _tag: "Quoted"; readonly quote: Pick<Quote, "side" | "shares" | "usdc"> }
  | { readonly _tag: "QuoteFailed" }

/**
 * The sentence under the trade box's field. A failed quote says nothing here: its alert says what went wrong, and
 * the amount is already typed.
 */
export const amountHint = (state: AmountState): string | null => {
  switch (state._tag) {
    case "Empty":
      if (state.side === "buy") return "Enter an amount. The smallest trade is $1."
      return state.held === BigInt(0) ? `You don't own any ${state.symbol} yet.` : "Enter how much to sell."
    case "BelowMinimum":
      return "The smallest trade is $1."
    case "OverAvailable":
      return state.side === "buy" ? "That's more than your cash." : "That's more than you have."
    case "Quoting":
      return "Getting a price…"
    case "Quoted": {
      const { side, shares, usdc } = state.quote
      return side === "buy" ?
        `About ${formatShareCount(shareCount(shares))} for ${formatMoney(usdcDollars(usdc))}.` :
        `About ${formatMoney(usdcDollars(usdc))} for ${formatShareCount(shareCount(shares))}.`
    }
    case "QuoteFailed":
      return null
  }
}
