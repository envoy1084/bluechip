// What every trigger, condition and action must satisfy, so a new one is checked by being registered.
import { Action, ACTIONS, Condition, CONDITIONS, Trigger, TRIGGERS } from "@bluechip/domain/automations/Automation"
import { catalogInfo } from "@bluechip/domain/automations/Catalog"
import type { EntryType, Field } from "@bluechip/domain/automations/Entry"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

type AnyEntry = EntryType<string, Schema.Codec<unknown>>

const catalogs = [
  {
    kind: "trigger",
    entries: TRIGGERS as unknown as ReadonlyArray<AnyEntry>,
    schema: Trigger as Schema.Codec<unknown>
  },
  {
    kind: "condition",
    entries: CONDITIONS as unknown as ReadonlyArray<AnyEntry>,
    schema: Condition as Schema.Codec<unknown>
  },
  { kind: "action", entries: ACTIONS as unknown as ReadonlyArray<AnyEntry>, schema: Action as Schema.Codec<unknown> }
]

const entries = catalogs.flatMap(({ entries, kind, schema }) =>
  entries.map((entry) => ({ kind, type: entry.type, entry, schema }))
)

describe("the automation catalogs", () => {
  it.each(catalogs)("$kind: lists each type once", ({ entries }) => {
    const types = entries.map((entry) => entry.type)

    assert.strictEqual(new Set(types).size, types.length)
  })

  it.each(entries)("$kind $type: its defaults survive JSON, as the API and the database store them", (item) => {
    const codec = Schema.toCodecJson(item.schema)
    const stored = { type: item.type, config: item.entry.defaults }

    const decoded = Schema.decodeUnknownSync(codec)(JSON.parse(JSON.stringify(Schema.encodeSync(codec)(stored))))

    assert.deepStrictEqual(decoded, stored)
  })

  it.each(entries)("$kind $type: every configuration field has editing hints, and only those", ({ entry }) => {
    assert.deepStrictEqual(
      Object.keys(entry.fields as Record<string, Field>).sort(),
      Object.keys(entry.defaults as object).sort()
    )
  })

  it.each(entries)("$kind $type: its defaults are within its fields' ranges", ({ entry }) => {
    const outside = Object.entries(entry.fields as Record<string, Field>).filter(([name, field]) => {
      const value = (entry.defaults as Record<string, unknown>)[name]
      if (typeof value !== "number" && typeof value !== "bigint") return false
      return (field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)
    })

    assert.deepStrictEqual(outside.map(([name]) => name), [])
  })

  it.each(entries)("$kind $type: the assistant and forms can find and say it", ({ entry }) => {
    const phrase = entry.describe(entry.defaults, { name: (symbol) => symbol })

    assert.isTrue(entry.title.length > 0 && entry.summary.length > 0)
    assert.isTrue(entry.aliases.length > 0 && entry.examples.length > 0)
    assert.isTrue(phrase.length > 0 && !phrase.includes("·"))
  })

  it("is described for the API with one entry per trigger, condition and action", () => {
    const described = catalogInfo().map((info) => `${info.kind}:${info.type}`)

    assert.deepStrictEqual(described, entries.map((item) => `${item.kind}:${item.type}`))
  })
})
