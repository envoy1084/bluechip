/**
 * The `gasBudget` policy: the most gas the agent may spend per UTC day, sponsored operations included. Set by bluechip
 * and enforced by Namera's gas policy.
 *
 * Namera charges each operation its maximum cost (gas limits × the most it offers per gas), not what it paid, so a
 * trade counts several times its real fee, more again when fees spike. 0.05 ETH a day leaves room for that and still
 * caps what a leaked session key can burn.
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
  summary: "The most gas it may spend a day: room for fee spikes, still a cap if its key leaked.",
  aliases: [],
  examples: [],
  config: GasBudgetConfig,
  fields: { weiPerDay: new Policy.Field({ label: "Gas a day", unit: "wei" }) },
  required: true,
  hidden: true,
  defaults: { weiPerDay: BigInt(5) * BigInt(10) ** BigInt(16) },
  describe: () => ({ can: [], never: [] }),
  compare: (before, after) => Policy.compareNumbers(before.weiPerDay, after.weiPerDay, "lower")
})
