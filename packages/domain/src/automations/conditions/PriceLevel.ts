/**
 * The `priceAbove` and `priceBelow` conditions: a stock's market price is over, or under, a price.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import { Price } from "../../market/Units.ts"
import * as Condition from "../Condition.ts"
import { Field } from "../Entry.ts"
import { formatPrice } from "../Format.ts"

/**
 * The stock and the price (USD × 1e8 per token).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PriceLevelConfig = Schema.Struct({ symbol: StockSymbol, level: Price })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceLevelConfig = typeof PriceLevelConfig.Type

const fields = {
  symbol: new Field({ label: "Stock", unit: "stock" }),
  level: new Field({ label: "Price", unit: "price", min: 1 })
}

const levelProblems = (config: PriceLevelConfig) =>
  config.level > BigInt(0) ? [] : [{ field: "level", message: "Pick a price above $0." }]

const evaluate = (side: "above" | "below") => (config: PriceLevelConfig, facts: Condition.Facts): Condition.Result => {
  const price = facts.prices.get(config.symbol)
  if (price === undefined) return { pass: false, reason: `No price for ${config.symbol}.` }
  const pass = side === "above" ? price > config.level : price < config.level
  return {
    pass,
    reason: `${config.symbol} is at ${formatPrice(price)}, ${pass ? "" : "not "}${side} ${formatPrice(config.level)}.`
  }
}

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const priceAbove = Condition.make({
  type: "priceAbove",
  title: "Price above",
  summary: "Only while a stock is above a price.",
  aliases: ["over", "higher than"],
  examples: ["Only if Apple is above $200"],
  config: PriceLevelConfig,
  fields,
  defaults: { symbol: "AAPL", level: Price.make(BigInt(20_000_000_000)) },
  check: levelProblems,
  describe: (config, { name }) => `if ${name(config.symbol)} is above ${formatPrice(config.level)}`,
  evaluate: evaluate("above")
})

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const priceBelow = Condition.make({
  type: "priceBelow",
  title: "Price below",
  summary: "Only while a stock is below a price.",
  aliases: ["under", "cheaper than", "lower than"],
  examples: ["Only if NVIDIA is under $150"],
  config: PriceLevelConfig,
  fields,
  defaults: { symbol: "NVDA", level: Price.make(BigInt(15_000_000_000)) },
  check: levelProblems,
  describe: (config, { name }) => `if ${name(config.symbol)} is below ${formatPrice(config.level)}`,
  evaluate: evaluate("below")
})
