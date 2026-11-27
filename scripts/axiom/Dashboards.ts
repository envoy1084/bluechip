import { METRICS } from "@bluechip/domain/analytics/Metrics"
import { Effect, FileSystem, Path, Schema } from "effect"

import { CheckFailed } from "../errors.ts"

/** The datasets bluechip sends to, by signal: the server's `AXIOM_*_DATASET`. */
export interface Datasets {
  readonly traces: string
  readonly logs: string
  readonly metrics: string
}

/** Marks the dashboards `axiom apply` owns, at the start of their description. */
export const TAG = "[bluechip]"

const Chart = Schema.Struct({
  id: Schema.String,
  type: Schema.Literals(["TimeSeries", "Statistic", "Table", "Pie", "Heatmap", "Note", "SmartFilter"]),
  query: Schema.optionalKey(
    Schema.Union([Schema.Struct({ mpl: Schema.String }), Schema.Struct({ apl: Schema.String })])
  )
})

/** What `apply` checks of a checked-in dashboard; the file itself is sent as it is. */
const DashboardFile = Schema.Struct({
  uid: Schema.String.check(Schema.isPattern(/^bluechip-[a-z0-9-]+$/)),
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  description: Schema.String.check(Schema.isStartingWith(TAG)),
  owner: Schema.String,
  charts: Schema.Array(Chart),
  layout: Schema.Array(
    Schema.Struct({ i: Schema.String, x: Schema.Int, y: Schema.Finite, w: Schema.Int, h: Schema.Finite })
  )
})

/** A dashboard to apply: its uid, and the dashboard as Axiom takes it, datasets filled in. */
export interface Dashboard {
  readonly uid: string
  readonly dashboard: Readonly<Record<string, unknown>>
}

const metricNames = new Set(METRICS.map((metric) => metric.name))

/**
 * The dashboards in `dir` (`*.json`, by file name), with `${TRACES_DATASET}`, `${LOGS_DATASET}` and
 * `${METRICS_DATASET}` replaced by `datasets`. Fails listing every problem: a file that isn't a dashboard, a layout
 * that doesn't match its charts, or a chart of a metric the catalogue doesn't have.
 */
export const loadDashboards = Effect.fn("axiom.loadDashboards")(function*(dir: string, datasets: Datasets) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const files = (yield* fs.readDirectory(dir)).filter((file) => file.endsWith(".json")).sort()
  const problems: Array<string> = []
  const dashboards: Array<Dashboard> = []

  for (const file of files) {
    const text = (yield* fs.readFileString(path.join(dir, file)))
      .replaceAll("${TRACES_DATASET}", datasets.traces)
      .replaceAll("${LOGS_DATASET}", datasets.logs)
      .replaceAll("${METRICS_DATASET}", datasets.metrics)
    const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(DashboardFile))(text).pipe(Effect.result)
    if (decoded._tag === "Failure") {
      problems.push(`${file}: ${decoded.failure.message}`)
      continue
    }

    const { charts, layout, uid } = decoded.success
    const chartIds = charts.map((chart) => chart.id)
    const placed = layout.map((item) => item.i)
    for (const id of chartIds.filter((id) => !placed.includes(id))) problems.push(`${file}: chart ${id} has no layout`)
    for (const id of placed.filter((id) => !chartIds.includes(id))) problems.push(`${file}: layout ${id} has no chart`)
    for (const chart of charts) {
      const mpl = chart.query !== undefined && "mpl" in chart.query ? chart.query.mpl : ""
      for (const [, metric] of mpl.matchAll(/`[^`]+`:`([^`]+)`/g)) {
        if (!metricNames.has(metric!)) {
          problems.push(`${file}: chart ${chart.id} charts ${metric}, not in the catalogue`)
        }
      }
    }

    dashboards.push({ uid, dashboard: JSON.parse(text) as Record<string, unknown> })
  }

  if (problems.length > 0) return yield* CheckFailed.make({ check: "axiom dashboards", problems })
  return dashboards
})
