/**
 * The `rebalance` policy: a target mix the agent may only trade toward, after Index Coop's onchain rebalancer. It
 * starts once the mix drifts past the trigger, sells only what is overweight and buys only what is underweight, never
 * passes a target, gets closer every time and keeps the portfolio's value. Enforced by `RebalanceRule`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { cashReserve } from "./CashReserve.ts"
import { formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { stockCap } from "./StockCap.ts"
import { trade } from "./Trade.ts"

/**
 * Something a portfolio holds: a stock, or cash (USDC).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Asset = Schema.Union([StockSymbol, Schema.Literal("USDC")])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Asset = typeof Asset.Type

/**
 * One asset's share of the target mix, in basis points.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Target = Schema.Struct({ asset: Asset, weight: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Target = typeof Target.Type

/**
 * The target mix (summing to 10,000 basis points) and how far off it the portfolio must drift before it trades.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const RebalanceConfig = Schema.Struct({
  targets: Schema.Array(Target),
  triggerBps: Schema.Int
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RebalanceConfig = typeof RebalanceConfig.Type

/**
 * How far past its target a rebalance may push an asset, in basis points of the portfolio.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const OVERSHOOT_BPS = 5

/**
 * How much a rebalance must reduce the drift from target, in basis points.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PROGRESS_BPS = 10

/**
 * The drift below which a portfolio counts as on target: a fifth of the trigger (1% for a 5% trigger).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const band = (config: RebalanceConfig): number => Math.floor(config.triggerBps / 5)

const targetProblems = (config: RebalanceConfig, policies: Policy.Entries): ReadonlyArray<string> => {
  const stocks = Policy.configOf(policies, trade)?.stocks ?? []
  const assets = config.targets.map((target) => target.asset)
  if (config.targets.length === 0) return ["Set a target mix."]
  if (new Set(assets).size !== assets.length) return ["Each stock can appear once in the mix."]
  if (stocks.some((symbol) => !assets.includes(symbol))) return ["Give every stock a target."]
  if (assets.some((asset) => asset !== "USDC" && !stocks.includes(asset))) {
    return ["The mix can only hold the stocks this agent trades, and cash."]
  }
  if (config.targets.some((target) => !Number.isInteger(target.weight) || target.weight < 0)) {
    return ["Targets can't be negative."]
  }
  if (config.targets.reduce((sum, target) => sum + target.weight, 0) !== 10_000) {
    return ["The mix has to add up to 100%."]
  }

  const cap = Policy.configOf(policies, stockCap)?.maxBps ?? 10_000
  if (config.targets.some((target) => target.asset !== "USDC" && target.weight > cap)) {
    return [`No stock's target can pass the max in one stock (${formatPercent(cap)}).`]
  }
  const reserve = Policy.configOf(policies, cashReserve)?.minBps ?? 0
  const cash = config.targets.find((target) => target.asset === "USDC")?.weight ?? 0
  return cash < reserve ? [`Cash's target can't be under the cash reserve (${formatPercent(reserve)}).`] : []
}

const sameTargets = (before: ReadonlyArray<Target>, after: ReadonlyArray<Target>): boolean =>
  before.length === after.length &&
  before.every((target) => after.some((other) => other.asset === target.asset && other.weight === target.weight))

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const rebalance = Policy.make({
  id: "rebalance",
  kind: "rule",
  title: "Target mix",
  summary: "Your target mix: it only trades to bring the portfolio back to it, once it drifts past the trigger.",
  aliases: ["rebalancing", "allocation", "target weights", "portfolio mix", "drift"],
  examples: ["Keep me at 60% Nvidia and 40% cash", "Rebalance when I'm 5% off"],
  config: RebalanceConfig,
  fields: {
    targets: new Policy.Field({ label: "Target mix", unit: "mix" }),
    triggerBps: new Policy.Field({
      label: "Rebalance when off by",
      unit: "bps",
      min: 100,
      max: 2000,
      choices: [
        300,
        500,
        1000
      ]
    })
  },
  required: false,
  hidden: false,
  requires: ["fairPrice"],
  defaults: { targets: [], triggerBps: 500 },
  validate: (config, policies) => [
    ...(Policy.configOf(policies, trade)?.direction === "rebalance" ?
      [] :
      [{ field: null, message: "Only an agent that rebalances has a target mix." }]),
    ...targetProblems(config, policies).map((message) => ({ field: "targets", message }))
  ],
  describe: (config) => ({
    can: [`Start rebalancing once your mix is ${formatPercent(config.triggerBps)} off target`],
    never: ["Trade away from your target mix"]
  }),
  compare: (before, after) =>
    Policy.combine([
      // A new mix lets the agent trade toward weights you haven't agreed to yet.
      sameTargets(before.targets, after.targets) ? "same" : "looser",
      Policy.compareNumbers(before.triggerBps, after.triggerBps, "higher")
    ])
})
