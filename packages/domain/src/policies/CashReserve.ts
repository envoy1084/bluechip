/**
 * The `cashReserve` policy: the smallest share of the portfolio the agent's trades may leave in cash. Enforced by
 * `CashReserveRule`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { stockCap } from "./StockCap.ts"

/**
 * The reserve, in basis points of the portfolio.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const CashReserveConfig = Schema.Struct({ minBps: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type CashReserveConfig = typeof CashReserveConfig.Type

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const cashReserve = Policy.make({
  id: "cashReserve",
  kind: "rule",
  title: "Cash reserve",
  summary: "The share of your money its trades always leave in cash.",
  aliases: ["minimum cash", "cash buffer", "keep cash"],
  examples: ["Always keep 10% in cash"],
  config: CashReserveConfig,
  fields: {
    minBps: new Policy.Field({ label: "Cash reserve", unit: "bps", min: 0, max: 5000, step: 500 })
  },
  required: false,
  hidden: false,
  defaults: { minBps: 1000 },
  validate: (config, policies) => {
    const cap = Policy.configOf(policies, stockCap)?.maxBps ?? 0
    return config.minBps + cap > 10_000 ?
      [{ field: "minBps", message: "Cash reserve plus max in one stock can't pass 100%." }] :
      []
  },
  describe: (config) => ({
    can: [],
    never: config.minBps > 0 ? [`Leave less than ${formatPercent(config.minBps)} in cash`] : []
  }),
  compare: (before, after) => Policy.compareNumbers(before.minBps, after.minBps, "higher")
})
