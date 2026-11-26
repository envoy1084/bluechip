/**
 * The `tradeSize` policy: the smallest and largest trade an agent's key may sign. Bigger trades are yours to approve
 * with Face ID. Enforced by `TradeSizeRule` (any trade's value at Chainlink's price) and by `AerodromeTradePolicy`'s
 * most USDC per buy.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Usdc } from "../market/Units.ts"
import { dollars, formatDollars } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { trade } from "./Trade.ts"

/**
 * The largest and smallest trade, in USDC units.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeSizeConfig = Schema.Struct({
  maxPerTrade: Usdc,
  minPerTrade: Usdc
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeSizeConfig = typeof TradeSizeConfig.Type

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const tradeSize = Policy.make({
  id: "tradeSize",
  kind: "rule",
  title: "Trade size",
  summary: "The largest trade it makes on its own; anything bigger waits for your Face ID.",
  aliases: ["max per trade", "ask me above", "approval threshold", "trade limit", "minimum trade"],
  examples: ["Ask me before any trade over $100", "Never trade more than $50 at once"],
  config: TradeSizeConfig,
  fields: {
    maxPerTrade: new Policy.Field({
      label: "Ask you above",
      unit: "usd",
      min: Number(dollars(10)),
      sliderMax: Number(dollars(1000)),
      step: Number(dollars(10)),
      choices: [50, 100, 400].map((amount) => Number(dollars(amount)))
    }),
    minPerTrade: new Policy.Field({
      label: "Smallest trade",
      unit: "usd",
      min: Number(dollars(1)),
      sliderMax: Number(dollars(100)),
      step: Number(dollars(1))
    })
  },
  required: true,
  hidden: false,
  defaults: { maxPerTrade: Usdc.make(dollars(100)), minPerTrade: Usdc.make(dollars(5)) },
  validate: (config, policies) => {
    const problems: Array<Policy.FieldProblem> = []
    if (config.minPerTrade > config.maxPerTrade) {
      problems.push({ field: "minPerTrade", message: "Can't be more than the largest trade." })
    }
    const budget = Policy.configOf(policies, trade)?.dailyBudget ?? BigInt(0)
    if (budget > BigInt(0) && config.maxPerTrade > budget) {
      problems.push({
        field: "maxPerTrade",
        message: `Can't be more than the daily budget (${formatDollars(budget)}).`
      })
    }
    return problems
  },
  describe: (config) => ({
    can: [`Trade up to ${formatDollars(config.maxPerTrade)} at a time, and ask you before anything bigger`],
    never: [`Make a trade under ${formatDollars(config.minPerTrade)}`]
  }),
  compare: (before, after) =>
    Policy.combine([
      Policy.compareNumbers(before.maxPerTrade, after.maxPerTrade, "lower"),
      Policy.compareNumbers(before.minPerTrade, after.minPerTrade, "higher")
    ])
})
