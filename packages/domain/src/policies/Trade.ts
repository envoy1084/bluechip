/**
 * The `trade` policy: what an agent may trade at all. Enforced on every operation by `AerodromeTradePolicy` (a swap
 * of the picked stocks on Aerodrome, in the agent's direction, within the daily budget) and, after it, by
 * `TradeGuard`'s check of what moved.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import { dollars, formatDollars, listNames } from "./Format.ts"
import * as Policy from "./Policy.ts"

/**
 * Which way an agent trades: only buys, only sells, both, or only back toward the target mix (with `rebalance`).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Direction = Schema.Literals(["buy", "sell", "both", "rebalance"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Direction = typeof Direction.Type

/**
 * The stocks, the direction, and the USDC it may put into buys per UTC day (0 for an agent that only sells).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TradeConfig = Schema.Struct({
  stocks: Schema.Array(StockSymbol),
  direction: Direction,
  dailyBudget: Usdc
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type TradeConfig = typeof TradeConfig.Type

/**
 * One UTC day, in seconds: the period of the daily budget and of the trade count.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DAY_SECONDS = 24 * 60 * 60

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const trade = Policy.make({
  id: "trade",
  kind: "trade",
  title: "Stocks and direction",
  summary: "The stocks it may trade, which way, and how much it may spend a day.",
  aliases: ["stocks", "direction", "daily budget", "spending limit", "allowance"],
  examples: ["Only trade Nvidia and Apple", "Let it buy up to $200 a day", "It should only sell"],
  config: TradeConfig,
  fields: {
    stocks: new Policy.Field({ label: "Stocks", unit: "stocks" }),
    direction: new Policy.Field({ label: "Direction", unit: "direction" }),
    dailyBudget: new Policy.Field({
      label: "Daily budget",
      unit: "usd",
      min: 0,
      sliderMax: Number(dollars(2000)),
      step: Number(dollars(10)),
      choices: [100, 250, 1000].map((amount) => Number(dollars(amount)))
    })
  },
  required: true,
  hidden: false,
  defaults: { stocks: [], direction: "both", dailyBudget: Usdc.make(dollars(250)) },
  validate: (config, policies) => {
    const problems: Array<Policy.FieldProblem> = []
    if (config.stocks.length === 0) problems.push({ field: "stocks", message: "Pick at least one stock." })
    if (new Set(config.stocks).size !== config.stocks.length) {
      problems.push({ field: "stocks", message: "Each stock can be picked once." })
    }
    if (config.direction === "sell" && config.dailyBudget > BigInt(0)) {
      problems.push({ field: "dailyBudget", message: "An agent that only sells never spends." })
    }
    if (config.direction !== "sell" && config.dailyBudget === BigInt(0)) {
      problems.push({ field: "dailyBudget", message: "Give it a daily budget to buy with." })
    }
    if (config.direction === "rebalance" && !policies.some((entry) => entry.id === "rebalance")) {
      problems.push({ field: "direction", message: "Set a target mix to rebalance toward." })
    }
    return problems
  },
  describe: (config, context) => {
    const stocks = listNames(config.stocks.map(context.name))
    const trade = {
      rebalance: `Trade ${stocks}, only to move you back to your target mix`,
      buy: `Buy ${stocks}`,
      sell: `Sell ${stocks}`,
      both: `Buy and sell ${stocks}`
    }[config.direction]
    return {
      can: [
        trade,
        ...(config.dailyBudget > BigInt(0) ? [`Spend up to ${formatDollars(config.dailyBudget)} a day`] : [])
      ],
      never: ["Send money out of your account", "Trade stocks you didn't pick"]
    }
  },
  compare: (before, after) =>
    Policy.combine([
      after.stocks.some((symbol) => !before.stocks.includes(symbol)) ?
        "looser" :
        before.stocks.some((symbol) => !after.stocks.includes(symbol)) ?
        "tighter" :
        "same",
      // A rebalance or a sale only ever narrows "both"; any other change of direction lets the agent do something new.
      before.direction === after.direction ? "same" : before.direction === "both" ? "tighter" : "looser",
      Policy.compareNumbers(before.dailyBudget, after.dailyBudget, "lower")
    ])
})
