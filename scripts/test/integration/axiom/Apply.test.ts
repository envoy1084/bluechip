import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Path, Redacted } from "effect"

import { applyAxiom } from "../../../axiom/Apply.ts"
import { loadDashboards } from "../../../axiom/Dashboards.ts"
import { AxiomTest } from "../../utils/AxiomTest.ts"

const api = { host: "https://api.axiom.co", token: Redacted.make("xapt-admin") }
const datasets = { traces: "bluechip-traces", logs: "bluechip-logs", metrics: "bluechip-metrics" }
const allThree = [
  { name: "bluechip-traces", kind: "otel:traces:v1" },
  { name: "bluechip-logs", kind: "otel:logs:v1" },
  { name: "bluechip-metrics", kind: "otel:metrics:v1" }
]
const checkedIn = Effect.gen(function*() {
  const dir = (yield* Path.Path).join(import.meta.dirname, "..", "..", "..", "axiom", "dashboards")
  return yield* loadDashboards(dir, datasets)
})

describe("applyAxiom", () => {
  it.effect("the datasets there, no dashboards: the eight dashboards made", () =>
    Effect.gen(function*() {
      const axiom = yield* AxiomTest
      const dashboards = yield* checkedIn

      const report = yield* applyAxiom(api, { datasets, dashboards }, { dryRun: false })

      assert.deepStrictEqual(
        [report.changes.length, report.unchanged, (yield* axiom.dashboards).map((entry) => entry.uid)],
        [8, 3, dashboards.map((dashboard) => dashboard.uid)]
      )
    }).pipe(Effect.provide(Layer.merge(AxiomTest.layer(allThree), NodeServices.layer))))

  it.effect("applied twice: the second run writes nothing", () =>
    Effect.gen(function*() {
      const axiom = yield* AxiomTest
      const dashboards = yield* checkedIn
      yield* applyAxiom(api, { datasets, dashboards }, { dryRun: false })
      const before = (yield* axiom.writes).length

      const report = yield* applyAxiom(api, { datasets, dashboards }, { dryRun: false })

      assert.deepStrictEqual([report.changes, report.unchanged, (yield* axiom.writes).length], [[], 11, before])
    }).pipe(Effect.provide(Layer.merge(AxiomTest.layer(allThree), NodeServices.layer))))

  it.effect("a dashboard edited in Axiom: written back from the file", () =>
    Effect.gen(function*() {
      const dashboards = yield* checkedIn
      yield* applyAxiom(api, { datasets, dashboards }, { dryRun: false })
      const trading = dashboards.find((dashboard) => dashboard.uid === "bluechip-trading")
      const edited = [{ ...trading!, dashboard: { ...trading!.dashboard, name: "bluechip Trading (old)" } }]
      yield* applyAxiom(api, { datasets, dashboards: edited }, { dryRun: false })

      const report = yield* applyAxiom(api, { datasets, dashboards }, { dryRun: false })

      assert.deepStrictEqual(report.changes, ["update dashboard \"bluechip Trading\""])
    }).pipe(Effect.provide(Layer.merge(AxiomTest.layer(allThree), NodeServices.layer))))

  it.effect("a dataset missing: made with its kind", () =>
    Effect.gen(function*() {
      const axiom = yield* AxiomTest

      yield* applyAxiom(api, { datasets, dashboards: [] }, { dryRun: false })

      assert.deepStrictEqual(
        (yield* axiom.datasets).map((dataset) => [dataset.name, dataset.kind]),
        [["bluechip-traces", "otel:traces:v1"], ["bluechip-logs", "otel:logs:v1"], [
          "bluechip-metrics",
          "otel:metrics:v1"
        ]]
      )
    }).pipe(Effect.provide(AxiomTest.layer(allThree.slice(0, 2)))))

  it.effect("a dataset of the wrong kind: left alone, listed by hand", () =>
    Effect.gen(function*() {
      const report = yield* applyAxiom(api, { datasets, dashboards: [] }, { dryRun: false })

      assert.deepStrictEqual([report.manual, yield* (yield* AxiomTest).writes], [[
        "Dataset bluechip-metrics is events, not otel:metrics:v1: delete it in Axiom (Settings > Datasets) and rerun, " +
        "or point AXIOM_METRICS_DATASET at a new name."
      ], []])
    }).pipe(Effect.provide(AxiomTest.layer([...allThree.slice(0, 2), { name: "bluechip-metrics", kind: "events" }]))))

  it.effect("a dry run: the changes listed, nothing written", () =>
    Effect.gen(function*() {
      const dashboards = yield* checkedIn

      const report = yield* applyAxiom(api, { datasets, dashboards }, { dryRun: true })

      assert.deepStrictEqual(
        [report.changes[0], report.changes.length, yield* (yield* AxiomTest).writes],
        ["create dataset bluechip-metrics (otel:metrics:v1)", 9, []]
      )
    }).pipe(Effect.provide(Layer.merge(AxiomTest.layer(allThree.slice(0, 2)), NodeServices.layer))))
})
