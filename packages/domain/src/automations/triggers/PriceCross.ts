/**
 * The `priceCross` trigger: a stock crosses a price, up or down. It fires on the crossing itself (a tick on the
 * other side after one on this side), so a stock already past the level when you set it up fires once it comes back
 * and crosses again.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import { Price } from "../../market/Units.ts"
import { stockProblems } from "../AgentLimits.ts"
import { Field } from "../Entry.ts"
import { formatPrice } from "../Format.ts"
import * as Trigger from "../Trigger.ts"

/**
 * The stock, the price (USD × 1e8 per token, Chainlink's scale) and the side it crosses to.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PriceCrossConfig = Schema.Struct({
  symbol: StockSymbol,
  level: Price,
  direction: Schema.Literals(["above", "below"])
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceCrossConfig = typeof PriceCrossConfig.Type

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const priceCross = Trigger.make({
  type: "priceCross",
  watcher: "price",
  marketHours: true,
  asks: false,
  title: "Price crosses a level",
  summary: "When a stock goes above or below a price you pick.",
  aliases: ["price alert", "goes above", "goes below", "breaks", "limit price"],
  examples: ["When Apple goes above $250, sell $100", "If Tesla falls under $300, buy $50"],
  config: PriceCrossConfig,
  fields: {
    symbol: new Field({ label: "Stock", unit: "stock" }),
    level: new Field({ label: "Price", unit: "price", min: 1 }),
    direction: new Field({ label: "Direction", unit: "choice" })
  },
  defaults: { symbol: "AAPL", level: Price.make(BigInt(25_000_000_000)), direction: "above" },
  check: (config, context) => [
    ...stockProblems("symbol", [config.symbol], context),
    ...(config.level > BigInt(0) ? [] : [{ field: "level", message: "Pick a price above $0." }])
  ],
  describe: (config, { name }) => `when ${name(config.symbol)} goes ${config.direction} ${formatPrice(config.level)}`
})

/**
 * What a tick does to a `priceCross` automation: the side it is on now, and a crossing to the chosen side fired
 * once (the window is the tick that crossed).
 *
 * @stability unstable
 * @category watching
 * @since 0.0.0
 */
export const stepPriceCross = (
  config: PriceCrossConfig,
  state: Trigger.WatchState,
  tick: Trigger.PriceTick
): Trigger.Step => {
  const side = tick.price > config.level ? "above" : tick.price < config.level ? "below" : state.side
  const next = { ...state, side }
  if (state.side === null || state.side === side || side !== config.direction) return { state: next, fire: null }
  return Trigger.fireOnce(next, `cross:${config.direction}:${tick.at}`)
}
