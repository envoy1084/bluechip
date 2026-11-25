/**
 * The `stockCap` policy: the largest share of the portfolio one stock may reach through the agent's trades. Enforced by
 * `StockCapRule`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"

/**
 * The cap, in basis points of the portfolio.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const StockCapConfig = Schema.Struct({ maxBps: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type StockCapConfig = typeof StockCapConfig.Type

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const stockCap = Policy.make({
  id: "stockCap",
  kind: "rule",
  title: "Max in one stock",
  summary: "The largest share of your money its trades may put in one stock.",
  aliases: ["concentration limit", "position limit", "diversification"],
  examples: ["Never put more than 20% in one stock"],
  config: StockCapConfig,
  fields: {
    maxBps: new Policy.Field({ label: "Max in one stock", unit: "bps", min: 500, max: 10_000, step: 500 })
  },
  required: false,
  hidden: false,
  defaults: { maxBps: 3000 },
  describe: (config) => ({
    can: [],
    never: config.maxBps < 10_000 ? [`Put over ${formatPercent(config.maxBps)} of your money in one stock`] : []
  }),
  compare: (before, after) => Policy.compareNumbers(before.maxBps, after.maxBps, "lower")
})
