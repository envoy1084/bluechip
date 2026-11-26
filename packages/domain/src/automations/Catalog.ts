/**
 * The automation catalogs as the API describes them, for forms, the assistant and other clients: every trigger,
 * condition and action with its copy, fields, defaults and configuration as JSON Schema; and a draft checked and
 * said in sentences.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { ACTIONS, AutomationDescription, AutomationProblem, CONDITIONS, TRIGGERS } from "./Automation.ts"
import { Field } from "./Entry.ts"

/**
 * A field of an entry as the API describes it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class EntryFieldInfo
  extends Schema.Class<EntryFieldInfo>("@bluechip/domain/automations/Catalog/EntryFieldInfo")({
    name: Schema.String,
    field: Field
  })
{}

/**
 * One catalog entry as the API describes it. Triggers also say whether they wait for the market by default and
 * whether what they start asks you first.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class EntryInfo extends Schema.Class<EntryInfo>("@bluechip/domain/automations/Catalog/EntryInfo")({
  kind: Schema.Literals(["trigger", "condition", "action"]),
  type: Schema.String,
  title: Schema.String,
  summary: Schema.String,
  aliases: Schema.Array(Schema.String),
  examples: Schema.Array(Schema.String),
  fields: Schema.Array(EntryFieldInfo),
  defaults: Schema.Json,
  schema: Schema.Json,
  marketHours: Schema.NullOr(Schema.Boolean),
  asks: Schema.NullOr(Schema.Boolean)
}) {}

/**
 * A draft read against the catalogs: why it can't be saved, and what it does in sentences.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AutomationCheck
  extends Schema.Class<AutomationCheck>("@bluechip/domain/automations/Catalog/AutomationCheck")({
    problems: Schema.Array(AutomationProblem),
    description: AutomationDescription
  })
{}

const info = (
  kind: EntryInfo["kind"],
  entry: {
    readonly type: string
    readonly title: string
    readonly summary: string
    readonly aliases: ReadonlyArray<string>
    readonly examples: ReadonlyArray<string>
    readonly config: Schema.Top
    readonly fields: object
    readonly defaults: unknown
    readonly marketHours?: boolean
    readonly asks?: boolean
  }
) => {
  const config = entry.config as Schema.Codec<unknown, unknown>
  return new EntryInfo({
    kind,
    type: entry.type,
    title: entry.title,
    summary: entry.summary,
    aliases: entry.aliases,
    examples: entry.examples,
    fields: Object.entries(entry.fields as Record<string, Field>).map(([name, field]) =>
      new EntryFieldInfo({ name, field })
    ),
    defaults: Schema.encodeSync(Schema.toCodecJson(config))(entry.defaults) as Schema.Json,
    schema: Schema.toJsonSchemaDocument(config) as unknown as Schema.Json,
    marketHours: entry.marketHours ?? null,
    asks: entry.asks ?? null
  })
}

/**
 * Every trigger, condition and action as the API describes them.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const catalogInfo = (): ReadonlyArray<EntryInfo> => [
  ...TRIGGERS.map((trigger) => info("trigger", trigger)),
  ...CONDITIONS.map((condition) => info("condition", condition)),
  ...ACTIONS.map((action) => info("action", action))
]
