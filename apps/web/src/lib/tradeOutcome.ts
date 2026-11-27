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

interface SentLeg {
  readonly side: "buy" | "sell"
  /** Set for a buy of a dollar amount. */
  readonly usdc: bigint | null
  readonly name: string
}

const nameList = new Intl.ListFormat("en-GB", { type: "conjunction" })

const VERBS = {
  buy: ["Buy", "Buying", "Bought"],
  sell: ["Sell", "Selling", "Sold"],
  mixed: ["Trade", "Trading", "Traded"]
} as const

// "$4,755.59 of Microsoft and Amazon" when every leg buys dollars, else only the names, each once.
const whatOf = (legs: ReadonlyArray<SentLeg>) => {
  const names = nameList.format([...new Set(legs.map((leg) => leg.name))])
  const dollars = legs.map((leg) => leg.usdc)
  if (dollars.some((usdc) => usdc === null)) return names
  const total = (dollars as ReadonlyArray<bigint>).reduce((sum, usdc) => sum + usdc, BigInt(0))
  return `${formatMoney(usdcDollars(total))} of ${names}`
}

const verbsOf = (legs: ReadonlyArray<SentLeg>) => {
  const sides = new Set(legs.map((leg) => leg.side))
  return VERBS[sides.size > 1 ? "mixed" : legs[0]!.side]
}

/** Several trades sent with one Face ID, in one line: "Buy $4,755.59 of Microsoft and Amazon", "Trade Apple and Tesla". */
export const describeTrades = (legs: ReadonlyArray<SentLeg>): string => `${verbsOf(legs)[0]} ${whatOf(legs)}`

/**
 * What several trades sent together came to, as one outcome: on their way until every one ends, then bought, sold or
 * traded, or which ones didn't go through.
 */
export const tradesOutcome = (
  trades: ReadonlyArray<{ readonly stage: TradeStage; readonly leg: SentLeg }>
): TradeOutcomeText => {
  const legs = trades.map((trade) => trade.leg)
  const [, going, done] = verbsOf(legs)

  if (trades.some((trade) => trade.stage === "sending" || trade.stage === "confirming")) {
    return {
      tone: "pending",
      title: `${going} ${whatOf(legs)}`,
      description: "Base confirms them in a couple of seconds."
    }
  }

  const filled = trades.filter((trade) => trade.stage === "filled").map((trade) => trade.leg)
  const failed = trades.filter((trade) => trade.stage === "failed").map((trade) => trade.leg)
  if (failed.length === 0) {
    const where = done === "Bought" ?
      "They're in your portfolio." :
      done === "Sold" ?
      "The cash is in your account." :
      "Your portfolio is up to date."
    return { tone: "success", title: `${done} ${whatOf(legs)}`, description: where }
  }
  if (filled.length === 0) {
    return {
      tone: "failure",
      title: "Your trades didn't go through",
      description: "Base didn't take them. Nothing moved."
    }
  }
  return {
    tone: "failure",
    title: "Only some went through",
    description: `${verbsOf(filled)[2]} ${whatOf(filled)}. ${whatOf(failed.map((leg) => ({ ...leg, usdc: null })))} ` +
      "didn't go through."
  }
}
