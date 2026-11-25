/**
 * Intents in words, for cards, activity and the assistant: what the trade is, and what the pipeline decided.
 *
 * @since 0.0.0
 */
import type { StockSymbol } from "../market/Market.ts"
import { policyOf } from "../policies/Catalog.ts"
import { formatDollars } from "../policies/Format.ts"
import type { Decision, Leg, WaitReason } from "./Intent.ts"

const shareFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 })

const centsFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/**
 * The trade: "Buy $50 of NVIDIA", "Sell 0.5 shares of Apple".
 *
 * **Example** (A buy)
 *
 * ```ts import.meta.vitest
 * import { describeLeg } from "@bluechip/domain/intents/Describe"
 *
 * describeLeg({ symbol: "NVDA", side: "buy", amount: { usdc: 50_000_000n } } as never, () => "NVIDIA") // => "Buy $50.00 of NVIDIA"
 * ```
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeLeg = (leg: Leg, name: (symbol: StockSymbol) => string): string => {
  const verb = leg.side === "buy" ? "Buy" : "Sell"
  if ("usdc" in leg.amount) {
    return `${verb} ${centsFormat.format(Number(leg.amount.usdc) / 1_000_000)} of ${name(leg.symbol)}`
  }
  const shares = Number(leg.amount.shares) / 100_000_000
  return `${verb} ${shareFormat.format(shares)} ${shares === 1 ? "share" : "shares"} of ${name(leg.symbol)}`
}

const WAITING: Readonly<Record<WaitReason, string>> = {
  pricesPaused: "prices are paused and this agent doesn't trade on them",
  pricesStale: "Chainlink's price is too old to trade on",
  noGas: "your account needs a little ETH for gas",
  dayEnding: "the UTC day is about to end",
  unavailable: "Base isn't answering"
}

/**
 * What the pipeline decided, as a sentence.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeDecision = (decision: Decision): string => {
  switch (decision._tag) {
    case "Passes":
      return "Within the agent's policies: it sends this itself."
    case "OverLargestTrade":
      return `Over the agent's largest trade (${formatDollars(decision.maxPerTrade)}): it needs your Face ID.`
    case "Refused":
      return `Blocked by ${policyOf(decision.policy).title}: ${decision.message}`
    case "Wait":
      return `Waiting: ${WAITING[decision.reason]}.`
  }
}
