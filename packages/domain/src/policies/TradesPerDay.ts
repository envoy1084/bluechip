/**
 * The `tradesPerDay` policy: how many operations the agent's key may send per UTC day. Enforced by Namera's rate limit
 * policy.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Policy from "./Policy.ts"

/**
 * Operations per UTC day.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradesPerDayConfig = Schema.Struct({ count: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradesPerDayConfig = typeof TradesPerDayConfig.Type

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const tradesPerDay = Policy.make({
  id: "tradesPerDay",
  kind: "namera",
  title: "Trades a day",
  summary: "How many times a day it may trade.",
  aliases: ["rate limit", "frequency", "how often"],
  examples: ["At most 3 trades a day"],
  config: TradesPerDayConfig,
  fields: {
    count: new Policy.Field({ label: "Trades a day", unit: "count", min: 1, max: 2000, step: 1 })
  },
  required: true,
  hidden: false,
  defaults: { count: 500 },
  describe: (config) => ({
    can: [config.count === 1 ? "Trade once a day at most" : `Trade ${config.count} times a day at most`],
    never: []
  }),
  compare: (before, after) => Policy.compareNumbers(before.count, after.count, "lower")
})
