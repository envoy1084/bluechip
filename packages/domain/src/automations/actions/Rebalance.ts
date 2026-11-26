/**
 * The `rebalance` action: the trades that bring the portfolio back to the agent's target mix (its `rebalance`
 * policy), sells first.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { rebalanceLegs } from "../../intents/RebalanceLegs.ts"
import { configOf } from "../../policies/Policy.ts"
import { rebalance as rebalancePolicy } from "../../policies/Rebalance.ts"
import * as Action from "../Action.ts"

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const rebalance = Action.make({
  type: "rebalance",
  title: "Rebalance",
  summary: "Trades back to the agent's target mix.",
  aliases: ["rebalance", "back to target", "restore my mix"],
  examples: ["rebalance back to 60/40"],
  config: Schema.Struct({}),
  fields: {},
  defaults: {},
  check: (_, context) =>
    context.spec !== null && configOf(context.spec.policies, rebalancePolicy) !== undefined ?
      [] :
      [{ field: null, message: "Only an agent with a target mix can rebalance." }],
  describe: () => "trade back to your target mix",
  plan: (_, context) => {
    const config = context.spec === null ? undefined : configOf(context.spec.policies, rebalancePolicy)
    return config === undefined ? [] : rebalanceLegs(context.portfolio, config, context.prices)
  }
})
