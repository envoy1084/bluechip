import { chainMetrics } from "@bluechip/chain/ChainTelemetry"
import { FORBIDDEN_METRIC_ATTRIBUTES, METRICS } from "@bluechip/domain/analytics/Metrics"
import { assert, describe, it } from "@effect/vitest"
import * as Metrics from "../../../../src/platform/telemetry/Metrics.ts"

// Every metric the server and the chain declare, as the catalogue describes one.
const declared = [
  ...(Object.values(Metrics) as ReadonlyArray<unknown>)
    .filter((value): value is Metrics.Instrument => typeof value === "object" && value !== null && "metric" in value)
    .map((instrument) => ({
      name: instrument.name,
      kind: instrument.kind,
      unit: instrument.unit,
      attributes: [...instrument.attributes]
    })),
  ...chainMetrics.map((entry) => ({
    name: entry.metric.id,
    kind: entry.kind,
    unit: entry.metric.attributes!["unit"]!,
    attributes: [...entry.attributes]
  }))
].sort((a, b) => a.name.localeCompare(b.name))

describe("the metric catalogue", () => {
  it("is what the server and the chain declare: names, kinds, units and attributes", () => {
    const catalogue = METRICS.map((metric) => ({
      name: metric.name,
      kind: metric.kind,
      unit: metric.unit,
      attributes: [...metric.attributes]
    })).sort((a, b) => a.name.localeCompare(b.name))

    assert.deepStrictEqual(declared, catalogue)
  })

  it("has no attribute that names a person or a record", () => {
    const named = declared.filter((metric) =>
      metric.attributes.some((attribute) => FORBIDDEN_METRIC_ATTRIBUTES.includes(attribute))
    )

    assert.deepStrictEqual(named, [])
  })
})

describe("sourceOf", () => {
  it.each(
    [
      ["owner", "owner", "you"],
      ["owner", "agent", "agent"],
      ["mcp", "agent", "agent"],
      ["channel", "owner", "telegram"],
      ["automation", "agent", "automation"],
      ["assistant", "owner", "assistant"]
    ] as const
  )("%s, signed by %s, is %s", (source, executor, expected) => {
    assert.strictEqual(Metrics.sourceOf(source, executor), expected)
  })
})
