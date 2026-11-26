/**
 * What every automation catalog entry has, whether a trigger, a condition or an action: its type, copy for people
 * and the assistant, a configuration Schema (so forms, the assistant's tools and the API share one definition), a
 * hint for editing each field, defaults, a check of a configuration against the agent it runs for, and a phrase that
 * says it. Entries are stored as `{ type, config }`.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import type { AgentSpec } from "../policies/AgentSpec.ts"

/**
 * What a configuration field holds, for editors and sentences: dollars (USDC units), basis points, a count, minutes,
 * a stock or several, a split across stocks, a price (Chainlink's scale), a time of day, weekdays, a time zone, one of
 * a few choices (the configuration's JSON Schema lists them), a switch, text, or the conditions of `all`/`any`/`not`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const FieldUnit = Schema.Literals([
  "usd",
  "bps",
  "count",
  "minutes",
  "stock",
  "stocks",
  "split",
  "price",
  "time",
  "weekdays",
  "timeZone",
  "choice",
  "toggle",
  "text",
  "conditions",
  "action"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type FieldUnit = typeof FieldUnit.Type

/**
 * How a field is edited: its label, unit, the range bluechip accepts (in the field's own units), its step and the
 * choices offered first; the same shape as a policy's field, with the units automations need.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Field extends Schema.Class<Field>("@bluechip/domain/automations/Entry/Field")({
  label: Schema.String,
  unit: FieldUnit,
  min: Schema.optional(Schema.Number),
  max: Schema.optional(Schema.Number),
  step: Schema.optional(Schema.Number),
  choices: Schema.optional(Schema.Array(Schema.Number))
}) {}

/**
 * Why a configuration can't be saved, as a sentence about one of its fields (`null`: the entry as a whole).
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
 * What a check reads: the policies of the agent the automation runs for (`null`: it proposes your own trades), the
 * automation's trigger type (some entries only make sense with some triggers), and whether its trades wait for your
 * approval (`asking`: your Face ID signs them, so the agent's amounts don't bind them).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface CheckContext {
  readonly spec: AgentSpec | null
  readonly trigger: string
  readonly asking?: boolean | undefined
}

/**
 * What a phrase may use: each stock's name.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface DescribeContext {
  readonly name: (symbol: StockSymbol) => string
}

/**
 * One entry of a catalog.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface EntryType<Type extends string = string, S extends Schema.Top = Schema.Top> {
  readonly type: Type
  readonly title: string
  readonly summary: string
  /** Other words people use for it, for the assistant. */
  readonly aliases: ReadonlyArray<string>
  /** Requests it answers, for the assistant. */
  readonly examples: ReadonlyArray<string>
  readonly config: S
  /** The stored entry: `{ type, config }`. */
  readonly entry: Schema.Struct<{ readonly type: Schema.Literal<Type>; readonly config: S }>
  readonly fields: { readonly [K in keyof S["Type"]]-?: Field }
  readonly defaults: S["Type"]
  readonly check: (config: S["Type"], context: CheckContext) => ReadonlyArray<FieldProblem>
  /** The entry as a phrase, for the automation's sentence: "every Monday at 10:00 New York time". */
  readonly describe: (config: S["Type"], context: DescribeContext) => string
}

/**
 * The options every `make` of a catalog takes: the entry without its derived `{ type, config }` schema, and with an
 * optional check.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type EntryOptions<Type extends string, S extends Schema.Top> =
  & Omit<EntryType<Type, S>, "entry" | "check">
  & { readonly check?: EntryType<Type, S>["check"] | undefined }

/**
 * An entry with its stored schema derived from its type and configuration.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const make = <const Type extends string, S extends Schema.Top>(
  options: EntryOptions<Type, S>
): EntryType<Type, S> => ({
  ...options,
  check: options.check ?? (() => []),
  entry: Schema.Struct({ type: Schema.Literal(options.type), config: options.config })
})
