import { NodeServices } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Path } from "effect"

import { loadDashboards } from "../../../axiom/Dashboards.ts"
import { CheckFailed } from "../../../errors.ts"
import { makeTempFolder } from "../../utils/TempFolder.ts"

const datasets = { traces: "t-traces", logs: "t-logs", metrics: "t-metrics" }
const probe = {
  uid: "bluechip-probe",
  name: "bluechip Probe",
  description: "[bluechip] A probe.",
  owner: "X-AXIOM-EVERYONE"
}

describe("loadDashboards", () => {
  it.effect("the checked-in dashboards: eight, every dataset filled in", () =>
    Effect.gen(function*() {
      const dir = (yield* Path.Path).join(import.meta.dirname, "..", "..", "..", "axiom", "dashboards")

      const dashboards = yield* loadDashboards(dir, datasets)

      const text = JSON.stringify(dashboards)
      assert.deepStrictEqual(
        [dashboards.length, text.includes("${"), text.includes("`t-metrics`:`bluechip.trades.filled`")],
        [8, false, true]
      )
    }).pipe(Effect.provide(NodeServices.layer)))

  it.effect("a chart of a metric the catalogue doesn't have: fails", () =>
    Effect.gen(function*() {
      const dir = yield* makeTempFolder("axiom-", {
        "probe.json": JSON.stringify({
          ...probe,
          charts: [{
            id: "a",
            type: "TimeSeries",
            query: { mpl: "`${METRICS_DATASET}`:`bluechip.nope`\n| align using sum" }
          }],
          layout: [{ i: "a", x: 0, y: 0, w: 6, h: 4 }]
        })
      })

      const error = yield* loadDashboards(dir, datasets).pipe(Effect.flip)

      assert.deepStrictEqual(
        error,
        CheckFailed.make({
          check: "axiom dashboards",
          problems: ["probe.json: chart a charts bluechip.nope, not in the catalogue"]
        })
      )
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))

  it.effect("a layout that doesn't match the charts: fails", () =>
    Effect.gen(function*() {
      const dir = yield* makeTempFolder("axiom-", {
        "probe.json": JSON.stringify({
          ...probe,
          charts: [{ id: "a", type: "Note", text: "hi" }],
          layout: [{ i: "b", x: 0, y: 0, w: 6, h: 4 }]
        })
      })

      const error = yield* loadDashboards(dir, datasets).pipe(Effect.flip)

      assert.deepStrictEqual(
        error,
        CheckFailed.make({
          check: "axiom dashboards",
          problems: ["probe.json: chart a has no layout", "probe.json: layout b has no chart"]
        })
      )
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)))
})
