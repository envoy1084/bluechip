// How often an agent's policies held it back, in words, for its page's results.
import type { AgentPerformance } from "@bluechip/domain/performance/Performance"
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
