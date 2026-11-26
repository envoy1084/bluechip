// An agent's results in words and shares, for its Results page: how often its policies held it back, and what its
// trades cost against what they moved.
import type { AgentPerformance, Costs } from "@bluechip/domain/performance/Performance"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"

const times = (count: number) => (count === 1 ? "once" : count === 2 ? "twice" : `${count} times`)

/**
 * "Its policies blocked 2 of the 5 trades it tried: Max in one stock twice." Nothing tried says so; nothing blocked
 * says that too.
 */
export const blockedSentence = (
  performance: Pick<AgentPerformance, "decided" | "blocked" | "blockedBy">,
  titleOf: (policy: PolicyId) => string
): string => {
  const tried = `${performance.decided} ${performance.decided === 1 ? "trade" : "trades"} it tried`
  if (performance.decided === 0) return "It hasn't tried a trade yet."
  if (performance.blocked === 0) return `Its policies haven't blocked any of the ${tried}.`

  const by = performance.blockedBy.map((row) => `${titleOf(row.policy)} ${times(row.count)}`).join(", ")
  return `Its policies blocked ${performance.blocked} of the ${tried}${by === "" ? "." : `: ${by}.`}`
}

/**
 * What trades cost in dollars (pool fees and slippage; slippage that beat Chainlink takes some back), and as a share of
 * what they moved, in percent: `null` when nothing moved.
 */
export const costShare = (
  performance: { readonly costs: Costs; readonly bought: bigint; readonly sold: bigint }
): { readonly dollars: bigint; readonly percent: number | null } => {
  const dollars = performance.costs.fees + performance.costs.slippage
  const moved = performance.bought + performance.sold
  return { dollars, percent: moved === BigInt(0) ? null : (Number(dollars) / Number(moved)) * 100 }
}
