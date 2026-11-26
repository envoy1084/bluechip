/**
 * The `all`, `any` and `not` conditions, over the other conditions decided by code (one level deep; a judgment goes
 * on its own, so its answer is always logged as a step of the run).
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import * as Condition from "../Condition.ts"
import { type DescribeContext, Field } from "../Entry.ts"
import { holdingAtLeast } from "./HoldingAtLeast.ts"
import { marketOpen, pricesFresh } from "./Market.ts"
import { priceAbove, priceBelow } from "./PriceLevel.ts"
import { timeWindow } from "./TimeWindow.ts"

/**
 * The conditions `all`, `any` and `not` combine.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SIMPLE_CONDITIONS = [marketOpen, pricesFresh, priceAbove, priceBelow, holdingAtLeast, timeWindow] as const

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SimpleCondition = Schema.Union(SIMPLE_CONDITIONS.map((condition) => condition.entry))

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SimpleCondition = typeof SimpleCondition.Type

const simpleOf = (entry: SimpleCondition) =>
  SIMPLE_CONDITIONS.find((condition) => condition.type === entry.type)! as unknown as Condition.ConditionType<
    string,
    Schema.Codec<unknown>
  >

const evaluateSimple = (entry: SimpleCondition, facts: Condition.Facts): Condition.Result =>
  simpleOf(entry).evaluate!(entry.config, facts)

const describeSimple = (entry: SimpleCondition, context: DescribeContext): string =>
  simpleOf(entry).describe(entry.config, context)

const joined = (phrases: ReadonlyArray<string>, word: string) =>
  phrases.length <= 1 ? phrases[0] ?? "" : `${phrases.slice(0, -1).join(", ")} ${word} ${phrases.at(-1)}`

/**
 * The conditions combined.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const LogicConfig = Schema.Struct({ conditions: Schema.Array(SimpleCondition) })

const fields = { conditions: new Field({ label: "Conditions", unit: "conditions" }) }

const atLeastOne = (config: typeof LogicConfig.Type) =>
  config.conditions.length === 0 ? [{ field: "conditions", message: "Add at least one condition." }] : []

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const all = Condition.make({
  type: "all",
  title: "All of",
  summary: "Only when every one of these holds.",
  aliases: ["and", "both"],
  examples: ["Only if the market is open and I still hold NVIDIA"],
  config: LogicConfig,
  fields,
  defaults: { conditions: [{ type: "marketOpen", config: {} }] },
  check: atLeastOne,
  describe: (config, context) => joined(config.conditions.map((entry) => describeSimple(entry, context)), "and"),
  evaluate: (config, facts) => {
    for (const entry of config.conditions) {
      const result = evaluateSimple(entry, facts)
      if (!result.pass) return result
    }
    return { pass: true, reason: "Every condition holds." }
  }
})

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const any = Condition.make({
  type: "any",
  title: "Any of",
  summary: "When at least one of these holds.",
  aliases: ["or", "either"],
  examples: ["If NVIDIA is under $150 or Apple is under $200"],
  config: LogicConfig,
  fields,
  defaults: { conditions: [{ type: "marketOpen", config: {} }] },
  check: atLeastOne,
  describe: (config, context) => joined(config.conditions.map((entry) => describeSimple(entry, context)), "or"),
  evaluate: (config, facts) => {
    const results = config.conditions.map((entry) => evaluateSimple(entry, facts))
    return results.find((result) => result.pass) ?? { pass: false, reason: "None of the conditions holds." }
  }
})

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const not = Condition.make({
  type: "not",
  title: "Not",
  summary: "Only when this doesn't hold.",
  aliases: ["unless", "except when"],
  examples: ["Unless the market is open"],
  config: Schema.Struct({ condition: SimpleCondition }),
  fields: { condition: new Field({ label: "Condition", unit: "conditions" }) },
  defaults: { condition: { type: "marketOpen", config: {} } },
  describe: (config, context) => `unless ${describeSimple(config.condition, context).replace(/^(if|while) /, "")}`,
  evaluate: (config, facts) => {
    const result = evaluateSimple(config.condition, facts)
    return { pass: !result.pass, reason: result.reason }
  }
})
