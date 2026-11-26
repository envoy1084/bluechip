/**
 * An onchain policy an agent's session key can carry, as bluechip describes it: its configuration (an Effect Schema,
 * so forms, the assistant's tools and the API share one definition), hints for editing each field, the bounds bluechip
 * accepts, and how to say it and compare two configurations. What the policy enforces lives in its contract; nothing
 * here decides a trade.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"

/**
 * Where a policy is enforced: bluechip's trade policy on each operation (`trade`), a rule `TradeGuard` runs after it
 * (`rule`), or one of Namera's own policies (`namera`).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PolicyKind = Schema.Literals(["trade", "rule", "namera"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PolicyKind = typeof PolicyKind.Type

/**
 * What a configuration field holds, for editors and sentences: dollars (USDC units), basis points, a count, the
 * stocks, the direction, the target mix, a price floor per stock, a switch, or wei.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const FieldUnit = Schema.Literals([
  "usd",
  "bps",
  "count",
  "stocks",
  "direction",
  "mix",
  "floors",
  "toggle",
  "wei"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type FieldUnit = typeof FieldUnit.Type

/**
 * How a field is edited: its label, unit, the range bluechip accepts (in the field's own units: USDC units for
 * dollars), its step, and the choices offered first.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Field extends Schema.Class<Field>("@bluechip/domain/policies/Policy/Field")({
  label: Schema.String,
  unit: FieldUnit,
  min: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  step: Schema.optional(Schema.Number),
  choices: Schema.optional(Schema.Array(Schema.Number))
}) {}

/**
 * How a configuration compares with the one in force: the same, tighter (the agent may do less) or looser.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Change = Schema.Literals(["same", "tighter", "looser"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Change = typeof Change.Type

/**
 * Why a configuration can't be locked, as a sentence about one of its fields (`null`: the policy as a whole).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface FieldProblem {
  readonly field: string | null
  readonly message: string
}

/**
 * What an agent can do, and what it can never do.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Description {
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
}

/**
 * A session's policies, as each policy reads the others' configurations.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Entries = ReadonlyArray<{ readonly id: string; readonly config: unknown }>

/**
 * What a policy's sentences may use: the whole session, and each stock's name.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface DescribeContext {
  readonly policies: Entries
  readonly name: (symbol: StockSymbol) => string
}

/**
 * An onchain policy in bluechip's catalog. `validate` checks only what bluechip accepts as input (bounds beyond the
 * field ranges, and agreement with the session's other policies); the contracts decide every operation.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PolicyType<Id extends string = string, S extends Schema.Top = Schema.Top> {
  readonly id: Id
  readonly kind: PolicyKind
  readonly title: string
  readonly summary: string
  /** Other words people use for it, for the assistant. */
  readonly aliases: ReadonlyArray<string>
  /** Requests it answers, for the assistant. */
  readonly examples: ReadonlyArray<string>
  readonly config: S
  /** The session entry carrying this policy: `{ id, config }`. */
  readonly entry: Schema.Struct<{ readonly id: Schema.Literal<Id>; readonly config: S }>
  readonly fields: { readonly [K in keyof S["Type"]]-?: Field }
  /** Every session carries it. */
  readonly required: boolean
  /** Set by bluechip, never by you: a session always carries it with its defaults. */
  readonly hidden: boolean
  readonly requires: ReadonlyArray<string>
  readonly conflicts: ReadonlyArray<string>
  readonly defaults: S["Type"]
  readonly validate: (config: S["Type"], policies: Entries) => ReadonlyArray<FieldProblem>
  readonly describe: (config: S["Type"], context: DescribeContext) => Description
  readonly compare: (before: S["Type"], after: S["Type"]) => Change
}

/**
 * A policy for the catalog; its session entry is derived from its id and configuration.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Id extends string, S extends Schema.Top>(
  options: Omit<PolicyType<Id, S>, "entry" | "requires" | "conflicts" | "validate"> & {
    readonly requires?: ReadonlyArray<string> | undefined
    readonly conflicts?: ReadonlyArray<string> | undefined
    readonly validate?: PolicyType<Id, S>["validate"] | undefined
  }
): PolicyType<Id, S> => ({
  ...options,
  requires: options.requires ?? [],
  conflicts: options.conflicts ?? [],
  validate: options.validate ?? (() => []),
  entry: Schema.Struct({ id: Schema.Literal(options.id), config: options.config })
})

/**
 * The configuration of `policy` in a session, if it carries it.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const configOf = <S extends Schema.Top>(
  policies: Entries,
  policy: PolicyType<string, S>
): S["Type"] | undefined => policies.find((entry) => entry.id === policy.id)?.config as S["Type"] | undefined

/**
 * A number compared with the one in force, when a lower one (`"lower"`) or a higher one is tighter.
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const compareNumbers = (
  before: number | bigint,
  after: number | bigint,
  tighter: "lower" | "higher"
): Change => {
  if (before === after) return "same"
  return (after < before) === (tighter === "lower") ? "tighter" : "looser"
}

/**
 * Several changes as one: looser if any is, tighter if any is, otherwise the same.
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const combine = (changes: ReadonlyArray<Change>): Change =>
  changes.includes("looser") ? "looser" : changes.includes("tighter") ? "tighter" : "same"
