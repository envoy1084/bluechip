/**
 * The `ask` action: the trades of another action, each waiting for your approval with Face ID instead of being sent
 * by the agent. News and judgments ask by default.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Action from "../Action.ts"
import { type DescribeContext, Field } from "../Entry.ts"
import { buy } from "./Buy.ts"
import { rebalance } from "./Rebalance.ts"
import { sell, sellShare } from "./Sell.ts"

/**
 * The actions that trade, which `ask` can wrap.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const TRADE_ACTIONS = [buy, sell, sellShare, rebalance] as const

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeAction = Schema.Union(TRADE_ACTIONS.map((action) => action.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeAction = typeof TradeAction.Type

/**
 * The catalog's trading action for an entry.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const tradeActionOf = (entry: TradeAction): Action.ActionType<string, Schema.Codec<unknown>> =>
  TRADE_ACTIONS.find((action) => action.type === entry.type)! as unknown as Action.ActionType<
    string,
    Schema.Codec<unknown>
  >

const describeTrade = (entry: TradeAction, context: DescribeContext) =>
  tradeActionOf(entry).describe(entry.config, context)

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const ask = Action.make({
  type: "ask",
  title: "Ask me first",
  summary: "Proposes the trades and waits for your approval with Face ID.",
  aliases: ["ask me", "check with me", "propose", "suggest"],
  examples: ["ask me whether to sell half my NVIDIA"],
  config: Schema.Struct({ trade: TradeAction }),
  fields: { trade: new Field({ label: "Trade to propose", unit: "action" }) },
  defaults: { trade: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } } },
  check: (config, context) => tradeActionOf(config.trade).check(config.trade.config, { ...context, asking: true }),
  describe: (config, context) => `ask you whether to ${describeTrade(config.trade, context)}`,
  plan: (config, context) => tradeActionOf(config.trade).plan!(config.trade.config, context)
})
