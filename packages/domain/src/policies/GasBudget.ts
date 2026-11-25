/**
 * The `gasBudget` policy: the most gas the agent may spend per UTC day, sponsored operations included. Set by bluechip
 * and enforced by Namera's gas policy.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Policy from "./Policy.ts"

/**
 * Wei per UTC day.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const GasBudgetConfig = Schema.Struct({ weiPerDay: Schema.BigInt })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type GasBudgetConfig = typeof GasBudgetConfig.Type

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const gasBudget = Policy.make({
  id: "gasBudget",
  kind: "namera",
  title: "Gas budget",
  summary: "The most gas it may spend a day: about 100 trades on Base.",
  aliases: [],
  examples: [],
  config: GasBudgetConfig,
  fields: { weiPerDay: new Policy.Field({ label: "Gas a day", unit: "wei" }) },
  required: true,
  hidden: true,
  defaults: { weiPerDay: BigInt(10) ** BigInt(15) },
  describe: () => ({ can: [], never: [] }),
  compare: (before, after) => Policy.compareNumbers(before.weiPerDay, after.weiPerDay, "lower")
})
