/**
 * The trades an automation's action makes when it fires: the action's legs, split so each fits the agent's largest
 * trade and no more than its trades per day. Trades that ask you first, and your own, aren't split: your Face ID
 * signs them, outside the agent's limits. The agent's onchain policies still decide each one.
 *
 * @since 0.0.0
 */
import type { Leg } from "../intents/Intent.ts"
import { Shares, sharesFor, Usdc, valueOf } from "../market/Units.ts"
import type { PlanContext } from "./Action.ts"
import { tradesFor } from "./actions/Buy.ts"
import { limitsOf } from "./AgentLimits.ts"
import { type Action, actionOf } from "./Automation.ts"

// `total` in `count` even parts, the remainder on the last, so no part is much smaller than the others.
const parts = (total: bigint, count: number): ReadonlyArray<bigint> => {
  const each = total / BigInt(count)
  return Array.from({ length: count }, (_, index) => index === count - 1 ? total - each * BigInt(count - 1) : each)
}

const split = (leg: Leg, maxPerTrade: bigint, context: PlanContext): ReadonlyArray<Leg> => {
  if ("usdc" in leg.amount) {
    return parts(leg.amount.usdc, tradesFor(leg.amount.usdc, maxPerTrade)).map((usdc) => ({
      ...leg,
      amount: { usdc: Usdc.make(usdc) }
    }))
  }
  const price = context.prices.get(leg.symbol)
  if (price === undefined) return [leg]
  const value = valueOf(leg.amount.shares, price)
  const count = Math.max(1, tradesFor(value, maxPerTrade))
  // A part's shares never pass the largest trade at this price.
  const most = sharesFor(Usdc.make(maxPerTrade), price)
  const pieces = parts(leg.amount.shares, count)
  return pieces.every((piece) => piece <= most || count === 1) ?
    pieces.map((shares) => ({ ...leg, amount: { shares: Shares.make(shares) } })) :
    parts(leg.amount.shares, count + 1).map((shares) => ({ ...leg, amount: { shares: Shares.make(shares) } }))
}

/**
 * The legs `action` makes now, in order (sells first in a rebalance), each within the agent's largest trade, at
 * most its trades per day; split only when `asking` is false and the automation trades through an agent.
 *
 * **Example** (Selling half of $250 of NVIDIA through a $100 largest trade)
 *
 * ```ts import.meta.vitest
 * import { planLegs } from "@bluechip/domain/automations/Planner"
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const spec = draftSpec({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * const portfolio = { value: 250_000_000n, holdings: [{ symbol: "NVDA", shares: 250_000_000n }] } as never
 * const prices = new Map([["NVDA", 10_000_000_000n]]) as never
 * planLegs({ type: "sellShare", config: { symbol: "NVDA", bps: 5000 } }, { portfolio, prices, spec }, false).length
 * // => 2
 * ```
 *
 * @stability unstable
 * @category planning
 * @since 0.0.0
 */
export const planLegs = (action: Action, context: PlanContext, asking: boolean): ReadonlyArray<Leg> => {
  const plan = actionOf(action).plan
  if (plan === null) return []
  const legs = (plan as (config: unknown, context: PlanContext) => ReadonlyArray<Leg>)(action.config, context)

  const limits = limitsOf(context.spec)
  if (asking || limits === null || limits.maxPerTrade === null) return legs
  const planned = legs.flatMap((leg) => split(leg, limits.maxPerTrade!, context))
  return limits.tradesPerDay === null ? planned : planned.slice(0, limits.tradesPerDay)
}
