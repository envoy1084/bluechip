// What every policy in the catalog must satisfy, so a new one is checked by being registered.
import { POLICIES, PolicyEntry, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import type { Field, PolicyType } from "@bluechip/domain/policies/Policy"
import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"

const policies = POLICIES as unknown as ReadonlyArray<PolicyType<PolicyId, Schema.Codec<unknown, unknown>>>

describe("the catalog", () => {
  it("lists each policy once", () => {
    const ids = policies.map((policy) => policy.id)

    assert.deepStrictEqual(new Set(ids).size, ids.length)
  })

  it.each(policies)("$id: its requirements and conflicts are policies of the catalog", (policy) => {
    const unknown = [...policy.requires, ...policy.conflicts].filter((id) =>
      !PolicyId.literals.includes(id as PolicyId)
    )

    assert.deepStrictEqual(unknown, [])
  })

  it.each(policies)("$id: its defaults survive JSON, as the API and the database store them", (policy) => {
    const codec = Schema.toCodecJson(PolicyEntry)
    const entry = { id: policy.id, config: policy.defaults } as PolicyEntry

    const decoded = Schema.decodeUnknownSync(codec)(JSON.parse(JSON.stringify(Schema.encodeSync(codec)(entry))))

    assert.deepStrictEqual(decoded, entry)
  })

  it.each(policies)("$id: every configuration field has editing hints, and only those", (policy) => {
    assert.deepStrictEqual(
      Object.entries(policy.fields as Record<string, Field>).map(([name]) => name).sort(),
      Object.keys(policy.defaults as object).sort()
    )
  })

  it.each(policies)("$id: its defaults are within its fields' ranges", (policy) => {
    const outside = Object.entries(policy.fields as Record<string, Field>).filter(([name, field]) => {
      const value = (policy.defaults as Record<string, unknown>)[name]
      if (field.min === undefined || field.max === undefined) return false
      return Number(value) < field.min || Number(value) > field.max
    })

    assert.deepStrictEqual(outside.map(([name]) => name), [])
  })

  it.each(policies)("$id: its defaults compared with themselves are the same", (policy) => {
    assert.strictEqual(policy.compare(policy.defaults, policy.defaults), "same")
  })

  it.each(policies.flatMap((policy) =>
    Object.entries(policy.fields as Record<string, Field>)
      .filter(([, field]) => field.min !== undefined && field.max !== undefined && field.min !== field.max)
      .map(([name, field]) => ({ id: policy.id, policy, name, field }))
  ))("$id.$name: one end of its range is tighter, the other looser", ({ field, name, policy }) => {
    const current = (policy.defaults as Record<string, unknown>)[name]
    const low = { ...(policy.defaults as object), [name]: typeof current === "bigint" ? BigInt(field.min!) : field.min }
    const high = {
      ...(policy.defaults as object),
      [name]: typeof current === "bigint" ? BigInt(field.max!) : field.max
    }

    const changes = [policy.compare(low, high), policy.compare(high, low)].sort()

    assert.deepStrictEqual(changes, ["looser", "tighter"])
  })

  it.each(policies.filter((policy) => !policy.hidden))(
    "$id: the assistant and forms can find and say it",
    (policy) => {
      const description = policy.describe(policy.defaults, {
        policies: policies.map((other) => ({ id: other.id, config: other.defaults })),
        name: (symbol) => symbol
      })

      assert.isTrue(policy.title.length > 0 && policy.summary.length > 0)
      assert.isTrue(policy.aliases.length > 0 && policy.examples.length > 0)
      assert.isTrue(description.can.length + description.never.length > 0)
    }
  )

  it.each(policies.filter((policy) => policy.hidden))("$id: hidden, so every session carries it", (policy) => {
    assert.isTrue(policy.required)
  })
})
