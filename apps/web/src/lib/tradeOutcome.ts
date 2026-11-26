// How a trade reads from the moment it's sent to its end, yours or an agent's: one line while Base takes it, then
// what it did or that nothing moved.
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { shareCount, usdcDollars } from "./amounts.ts"

/** Where a sent trade is. Base takes a couple of seconds, so sending and confirming read as one wait. */
export type TradeStage = "sending" | "confirming" | "filled" | "failed"

export interface TradeOutcomeText {
  readonly tone: "pending" | "success" | "failure"
  readonly title: string
  readonly description: string
}

/** "Nothing was bought. Your cash is where it was.", for a trade that ended without moving money. */
export const nothingMoved = (side: "buy" | "sell"): string =>
  side === "buy"
    ? "Nothing was bought. Your cash is where it was."
    : "Nothing was sold. Your stocks are where they were."

/** A sent trade in words: "Buy $50.00 of Apple" for a buy, by its shares for a sell ("Sell 0.25 shares of Nvidia"). */
export const describeTrade = (
  trade: { readonly side: "buy" | "sell"; readonly usdc: bigint; readonly shares: bigint },
  name: string
): string =>
  trade.side === "buy"
    ? `Buy ${formatMoney(usdcDollars(trade.usdc))} of ${name}`
    : `Sell ${formatShareCount(shareCount(trade.shares))} of ${name}`

/**
 * The end state's words for a trade described as "Buy $50 of Apple": "Buying $50 of Apple" while it's on its way,
 * "Bought $50 of Apple" once filled, or that it didn't go through and nothing moved.
 */
export const tradeOutcome = (stage: TradeStage, side: "buy" | "sell", described: string): TradeOutcomeText => {
  const rest = described.replace(/^(Buy|Sell) /, "")

  if (stage === "filled") {
    return {
      tone: "success",
      title: `${side === "buy" ? "Bought" : "Sold"} ${rest}`,
      description: side === "buy" ? "It's in your portfolio." : "The cash is in your account."
    }
  }
  if (stage === "failed") {
    return {
      tone: "failure",
      title: side === "buy" ? "Your buy didn't go through" : "Your sell didn't go through",
      description: `Base didn't take it. ${nothingMoved(side)}`
    }
  }
  return {
    tone: "pending",
    title: `${side === "buy" ? "Buying" : "Selling"} ${rest}`,
    description: "Base confirms it in a couple of seconds."
  }
}
