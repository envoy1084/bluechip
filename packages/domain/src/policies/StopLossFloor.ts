/**
 * The `stopLossFloor` policy: the agent may sell a stock only while Chainlink's price is at or under the floor you set
 * for it, so a Stop-loss guard never sells at a good price. Buys are not affected. Enforced by `StopLossFloorRule`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { Price } from "../market/Units.ts"
import { formatPrice } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { trade } from "./Trade.ts"

/**
 * One stock's floor: the highest Chainlink price (USD × 1e8 per share) the agent may sell it at.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Floor = Schema.Struct({ symbol: StockSymbol, price: Price })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Floor = typeof Floor.Type

/**
 * A floor for each stock the agent trades.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const StopLossFloorConfig = Schema.Struct({ floors: Schema.Array(Floor) })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type StopLossFloorConfig = typeof StopLossFloorConfig.Type

const floorProblems = (config: StopLossFloorConfig, policies: Policy.Entries): ReadonlyArray<string> => {
  const stocks = Policy.configOf(policies, trade)?.stocks ?? []
  const symbols = config.floors.map((floor) => floor.symbol)
  if (new Set(symbols).size !== symbols.length) return ["Each stock can have one floor."]
  if (symbols.some((symbol) => !stocks.includes(symbol))) return ["Floors can only be set for the stocks it trades."]
  if (stocks.some((symbol) => !symbols.includes(symbol))) return ["Give every stock a floor."]
  return config.floors.some((floor) => floor.price <= BigInt(0)) ? ["A floor has to be more than $0."] : []
}

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const stopLossFloor = Policy.make({
  id: "stopLossFloor",
  kind: "rule",
  title: "Stop-loss floor",
  summary: "Sells a stock only at or under the floor you set.",
  aliases: ["stop loss", "sell only below", "floor price", "stop price", "sell trigger"],
  examples: ["Only sell Nvidia if it falls under $150", "Sell Apple once it drops below $180"],
  config: StopLossFloorConfig,
  fields: {
    floors: new Policy.Field({ label: "Sell only at or under", unit: "floors" })
  },
  required: false,
  hidden: false,
  defaults: { floors: [] },
  validate: (config, policies) => {
    const direction = Policy.configOf(policies, trade)?.direction
    return [
      ...(direction === "sell" || direction === "both" ?
        [] :
        [{ field: null, message: "Only an agent that sells has a stop-loss floor." }]),
      ...floorProblems(config, policies).map((message) => ({ field: "floors", message }))
    ]
  },
  describe: (config, context) => ({
    can: [],
    never: config.floors.length === 0 ?
      ["Sell a stock you haven't set a floor for"] :
      config.floors.map((floor) => `Sell ${context.name(floor.symbol)} above ${formatPrice(floor.price)}`)
  }),
  compare: (before, after) =>
    Policy.combine([
      // Without its floor a stock can't be sold at all; a new floor lets the agent sell a stock it couldn't.
      ...before.floors.map((floor) => {
        const next = after.floors.find((other) => other.symbol === floor.symbol)
        return next === undefined ? "tighter" : Policy.compareNumbers(floor.price, next.price, "lower")
      }),
      ...after.floors.map((floor) => before.floors.some((other) => other.symbol === floor.symbol) ? "same" : "looser")
    ])
})
