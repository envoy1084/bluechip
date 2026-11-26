// Why a trade was decided as it was, in three parts for its card: the policy that decided it, the limit it met, and
// what would have gone through instead.
import type { Decision } from "@bluechip/domain/intents/Intent"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface DecisionFacts {
  /** The policy that decided it; `null` when none did (it passed, or it waits). */
  readonly policy: string | null
  /** The limit it met, in its words. */
  readonly limit: string | null
  /** What would pass instead; `null` when nothing would change the answer. */
  readonly wouldPass: string | null
}

const WOULD_PASS: Readonly<Partial<Record<PolicyId, string>>> = {
  trade: "A trade in a stock it may trade, its way, within today's budget.",
  tradeSize: "A trade between its smallest and largest trade.",
  fairPrice: "The same trade once the pool's price is back near Chainlink's.",
  stockCap: "A smaller buy, keeping the stock under its share of your money.",
  cashReserve: "A smaller buy, keeping your cash reserve.",
  rebalance: "A trade back toward its target mix.",
  stopLossFloor: "A sale at a price above its floor.",
  slippageBudget: "The same trade once the week's losses to prices age out.",
  tradesPerDay: "The same trade tomorrow, once its count starts again at midnight UTC.",
  gasBudget: "The same trade once gas costs less."
}

const dollars = (units: bigint) => formatMoney(usdcDollars(units)).replace(/\.00$/u, "")

/** The facts of `decision`. */
export const decisionFacts = (decision: Decision): DecisionFacts => {
  switch (decision._tag) {
    case "Passes":
      return { policy: null, limit: null, wouldPass: null }
    case "OverLargestTrade":
      return {
        policy: policyOf("tradeSize").title,
        limit: `Its largest trade on its own is ${dollars(decision.maxPerTrade)}.`,
        wouldPass: `A trade of ${dollars(decision.maxPerTrade)} or less goes without asking you.`
      }
    case "Ask":
      return { policy: null, limit: "It asks you before every trade.", wouldPass: null }
    case "Refused":
      return {
        policy: policyOf(decision.policy).title,
        limit: decision.message,
        wouldPass: WOULD_PASS[decision.policy] ?? null
      }
    case "Wait":
      return { policy: null, limit: null, wouldPass: "The same trade, once the wait is over. Nothing to do." }
  }
}
