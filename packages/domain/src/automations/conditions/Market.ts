/**
 * The `marketOpen` and `pricesFresh` conditions: regular trading is on, and every price the automation reads is
 * fresh (a stream gap or a stale feed keeps it from going on).
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Condition from "../Condition.ts"

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const marketOpen = Condition.make({
  type: "marketOpen",
  title: "Market open",
  summary: "Only during regular trading hours.",
  aliases: ["trading hours", "during the day", "when the market is open"],
  examples: ["Only while the market is open"],
  config: Schema.Struct({}),
  fields: {},
  defaults: {},
  describe: () => "while the market is open",
  evaluate: (_, facts) =>
    facts.marketOpen ?
      { pass: true, reason: "The market is open." } :
      { pass: false, reason: "The market is closed." }
})

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const pricesFresh = Condition.make({
  type: "pricesFresh",
  title: "Prices fresh",
  summary: "Only while the prices it reads are up to date.",
  aliases: ["live prices", "fresh data"],
  examples: ["Only on live prices"],
  config: Schema.Struct({}),
  fields: {},
  defaults: {},
  describe: () => "while prices are fresh",
  evaluate: (_, facts) =>
    facts.pricesFresh ?
      { pass: true, reason: "Prices are fresh." } :
      { pass: false, reason: "Prices are stale." }
})
