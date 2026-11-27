import { Effect, Predicate } from "effect"

import { matches } from "../posthog/Matches.ts"
import { type AxiomApi, call } from "./Api.ts"
import type { Dashboard, Datasets } from "./Dashboards.ts"

/** The kind each signal's dataset must be: Axiom's OpenTelemetry datasets. */
export const DATASET_KINDS: Readonly<Record<keyof Datasets, string>> = {
  traces: "otel:traces:v1",
  logs: "otel:logs:v1",
  metrics: "otel:metrics:v1"
}

/** What a run did (or would do, dry), and what's left by hand. */
interface AxiomReport {
  readonly changes: ReadonlyArray<string>
  readonly unchanged: number
  readonly manual: ReadonlyArray<string>
}

type Entry = Readonly<Record<string, unknown>>

/**
 * Makes Axiom hold bluechip's three datasets (made when missing, with the right kind) and its dashboards (found by
 * uid, written only when they differ; the checked-in file wins over edits made in Axiom's UI). A dataset of the wrong
 * kind can't be changed: it goes to the manual list, as does anything Axiom refuses. No monitors or notifiers.
 */
export const applyAxiom = Effect.fn("axiom.apply")(function*(
  api: AxiomApi,
  want: { readonly datasets: Datasets; readonly dashboards: ReadonlyArray<Dashboard> },
  options: { readonly dryRun: boolean }
) {
  const changes: Array<string> = []
  const manual: Array<string> = []
  let unchanged = 0

  const write = (what: string, path: string, body: unknown) =>
    options.dryRun ? Effect.void : call(api, "POST", path, body).pipe(
      Effect.asVoid,
      Effect.catchTag(
        "ToolFailed",
        ({ output }) => Effect.sync(() => void manual.push(`${what}: Axiom refused it (${output}).`))
      )
    )

  const datasets = (yield* call(api, "GET", "/v2/datasets")) as ReadonlyArray<Entry>
  for (const [signal, name] of Object.entries(want.datasets) as ReadonlyArray<[keyof Datasets, string]>) {
    const kind = DATASET_KINDS[signal]
    const existing = datasets.find((dataset) => dataset.name === name)
    if (existing === undefined) {
      changes.push(`create dataset ${name} (${kind})`)
      yield* write(`create dataset ${name}`, "/v2/datasets", { name, kind, description: `bluechip ${signal}` })
      continue
    }
    if (existing.kind !== kind) {
      manual.push(
        `Dataset ${name} is ${
          String(existing.kind)
        }, not ${kind}: delete it in Axiom (Settings > Datasets) and rerun, ` +
          `or point AXIOM_${signal.toUpperCase()}_DATASET at a new name.`
      )
      continue
    }
    unchanged++
  }

  const current = (yield* call(api, "GET", "/v2/dashboards")) as ReadonlyArray<Entry>
  for (const { dashboard, uid } of want.dashboards) {
    const existing = current.find((entry) => entry.uid === uid)
    const saved = existing !== undefined && Predicate.isObject(existing.dashboard) ? existing.dashboard : undefined
    if (saved !== undefined && matches(dashboard, saved)) {
      unchanged++
      continue
    }
    changes.push(`${saved === undefined ? "create" : "update"} dashboard "${String(dashboard.name)}"`)
    yield* write(`dashboard ${uid}`, "/v2/dashboards", { uid, dashboard, overwrite: saved !== undefined })
  }

  return { changes, unchanged, manual } satisfies AxiomReport
})
