// A rebalance as one plan: the trades `proposeRebalance` proposed, and the portfolio's mix before and after them.
import type { Card } from "@bluechip/domain/assistant/Card"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { valueOf } from "@bluechip/domain/market/Units"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"

/** One part of the mix, in percent of everything (cash included), before and after the plan. */
export interface MixShift {
  readonly id: StockSymbol | "cash"
  readonly before: number
  readonly after: number
}

/** The trades of a rebalance's cards, in the order they were proposed. */
export const planLegs = (cards: ReadonlyArray<Card>): ReadonlyArray<Intent> =>
  cards.flatMap((card) => card._tag === "Trade" || card._tag === "Approval" ? [card.intent] : [])

const ZERO = BigInt(0)

/**
 * The mix before and after `legs` fill at today's prices: a buy moves its dollars from cash into the stock, a sale its
 * shares' value back. Biggest holding first, new stocks after, cash last; `null` for an empty portfolio. Costs are left
 * out, so the total stays the same.
 */
export const mixShifts = (portfolio: Portfolio, legs: ReadonlyArray<Intent>): ReadonlyArray<MixShift> | null => {
  const total = portfolio.value
  if (total <= ZERO) return null

  const before = new Map<StockSymbol | "cash", bigint>(
    portfolio.holdings.map((holding) => [holding.symbol, holding.value])
  )
  before.set("cash", portfolio.cash)
  const after = new Map(before)
  const move = (id: StockSymbol | "cash", amount: bigint) => after.set(id, (after.get(id) ?? ZERO) + amount)

  for (const { leg } of legs) {
    const price = portfolio.holdings.find((holding) => holding.symbol === leg.symbol)?.price?.price ?? null
    const amount = "usdc" in leg.amount ?
      leg.amount.usdc :
      price === null ?
      ZERO :
      valueOf(leg.amount.shares, price)
    const signed = leg.side === "buy" ? amount : -amount
    move(leg.symbol, signed)
    move("cash", -signed)
  }

  const share = (value: bigint) => Number(value * BigInt(10_000) / total) / 100
  const stocks = [...after.keys()].filter((id) => id !== "cash")

  return [...stocks, "cash" as const].map((id) => {
    const left = after.get(id) ?? ZERO
    return { id, before: share(before.get(id) ?? ZERO), after: share(left > ZERO ? left : ZERO) }
  })
}
