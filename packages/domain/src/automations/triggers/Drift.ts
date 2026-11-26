/**
 * The `drift` trigger: the portfolio drifts from the agent's target mix (its `rebalance` policy) by more than that
 * policy's trigger. It fires on drifting past it, and again only after the mix came back within the policy's band.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { configOf } from "../../policies/Policy.ts"
import { band, rebalance, type RebalanceConfig } from "../../policies/Rebalance.ts"
import type { Portfolio } from "../../portfolio/Portfolio.ts"
import * as Trigger from "../Trigger.ts"

/**
 * Nothing to set: the target mix and the trigger come from the agent's `rebalance` policy.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const DriftConfig = Schema.Struct({})

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const drift = Trigger.make({
  type: "drift",
  watcher: "portfolio",
  marketHours: true,
  asks: false,
  title: "Mix drifts",
  summary: "When your mix drifts from the agent's target mix by more than its trigger.",
  aliases: ["rebalance when off", "drift", "out of balance", "allocation drift"],
  examples: ["Keep me at 60/40 and rebalance when I drift 5%"],
  config: DriftConfig,
  fields: {},
  defaults: {},
  check: (_, context) => {
    if (context.spec === null) return [{ field: null, message: "Only an agent with a target mix can watch drift." }]
    return configOf(context.spec.policies, rebalance) === undefined ?
      [{ field: null, message: "Give the agent a target mix first." }] :
      []
  },
  describe: () => "when your mix drifts past the agent's trigger"
})

const BPS = BigInt(10_000)

/**
 * How far the portfolio is from its target mix: the largest gap of any asset, cash included, in basis points.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const driftOf = (portfolio: Pick<Portfolio, "value" | "cash" | "holdings">, config: RebalanceConfig): number => {
  if (portfolio.value === BigInt(0)) return 0
  return Math.max(
    0,
    ...config.targets.map((target) => {
      const held = target.asset === "USDC" ?
        portfolio.cash :
        portfolio.holdings.find((holding) => holding.symbol === target.asset)?.value ?? BigInt(0)
      return Math.abs(Number((held * BPS) / portfolio.value) - target.weight)
    })
  )
}

/**
 * What a portfolio change does to a `drift` automation: past the trigger it fires once; back within the band it
 * is armed again.
 *
 * @stability unstable
 * @category watching
 * @since 0.0.0
 */
export const stepDrift = (
  config: RebalanceConfig,
  state: Trigger.WatchState,
  portfolio: Pick<Portfolio, "value" | "cash" | "holdings">,
  at: string
): Trigger.Step => {
  const gap = driftOf(portfolio, config)
  if (gap >= config.triggerBps) {
    if (state.side === "above") return { state, fire: null }
    return Trigger.fireOnce({ ...state, side: "above" }, `drift:${at}`)
  }
  return { state: gap < band(config) ? { ...state, side: "below" } : state, fire: null }
}
