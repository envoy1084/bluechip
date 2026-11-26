// The most an agent could do on its worst day and week, from the limits its policies lock: what it could spend, what
// its trades could move, and the most prices could cost it while each trade stays within its fair-price limit.
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf } from "@bluechip/domain/policies/Policy"
import { slippageBudget } from "@bluechip/domain/policies/SlippageBudget"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { tradesPerDay } from "@bluechip/domain/policies/TradesPerDay"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface WorstCase {
  /** The most it could spend on buys in a day (USDC units): 0 for an agent that only sells. */
  readonly daySpend: bigint
  /** Its trades a day and the largest one; `null` when no policy caps it. */
  readonly trades: number | null
  readonly perTrade: bigint | null
  /** What its trades could move in a day, buys and sells; `null` when sells aren't capped. */
  readonly dayMoved: bigint | null
  /** The most prices could cost a day's trades against Chainlink (its fair-price limit); `null` without one. */
  readonly dayLoss: bigint | null
  /** The most its weekly slippage limit lets it lose, in basis points of your money; `null` without one. */
  readonly weeklyLossBps: number | null
}

const WEEK = BigInt(7)

const smaller = (a: bigint, b: bigint | null): bigint => b === null || a < b ? a : b

/** The worst case of `spec`'s limits. */
export const worstCaseOf = (spec: AgentSpec): WorstCase => {
  const trading = configOf(spec.policies, trade)
  const size = configOf(spec.policies, tradeSize)
  const perDay = configOf(spec.policies, tradesPerDay)
  const price = configOf(spec.policies, fairPrice)
  const slippage = configOf(spec.policies, slippageBudget)

  const trades = perDay?.count ?? null
  const perTrade = size?.maxPerTrade ?? null
  const capped = trades === null || perTrade === null ? null : BigInt(trades) * perTrade
  const budget = trading === undefined || trading.direction === "sell" ? BigInt(0) : trading.dailyBudget
  const daySpend = smaller(budget, capped)
  const dayMoved = trading?.direction === "buy" ? daySpend : capped

  return {
    daySpend,
    trades,
    perTrade,
    dayMoved,
    dayLoss: dayMoved === null || price === undefined ? null : dayMoved * BigInt(price.collarBps) / BigInt(10_000),
    weeklyLossBps: slippage?.weeklyBps ?? null
  }
}

const dollars = (units: bigint) => formatMoney(usdcDollars(units)).replace(/\.00$/u, "")

const percent = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`

/** The worst case in sentences, for the draft's card. */
export const worstCaseLines = (worst: WorstCase): ReadonlyArray<string> => {
  const count = worst.trades === 1 ? "one trade" : `up to ${worst.trades} trades`
  const counted = worst.trades === null ?
    "" :
    worst.perTrade === null ?
    ` in ${count}` :
    ` in ${count} of ${dollars(worst.perTrade)}`
  // Its count of trades says how it spends only when they can't add up to more than the budget: $250 a day is never
  // "500 trades of $100".
  const sizes =
    worst.trades !== null && worst.perTrade !== null && BigInt(worst.trades) * worst.perTrade > worst.daySpend ?
      ` in trades of up to ${dollars(worst.perTrade)}` :
      counted
  const spending = worst.daySpend === BigInt(0) ?
    `It never spends your cash: it only sells${counted === "" ? "" : `,${counted.replace(" in", "")} a day`}.` :
    `On its worst day it could spend ${dollars(worst.daySpend)}${sizes}, ${dollars(worst.daySpend * WEEK)} in a week.`

  const prices = worst.dayLoss === null ?
    [] :
    [
      `Each trade stays close to Chainlink's price, so prices could cost it at most ${dollars(worst.dayLoss)} a day, ` +
      `${dollars(worst.dayLoss * WEEK)} a week.`
    ]
  const slippage = worst.weeklyLossBps === null ?
    [] :
    [`It stops once it has lost ${percent(worst.weeklyLossBps)} of your money to prices in a week.`]

  return [spending, ...prices, ...slippage, "It can never send money out of your account."]
}
