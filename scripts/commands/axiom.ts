import { Config, Console, Effect, Path } from "effect"
import { Command, Flag } from "effect/cli"

import { AXIOM_API_HOST } from "../axiom/Api.ts"
import { applyAxiom } from "../axiom/Apply.ts"
import { loadDashboards } from "../axiom/Dashboards.ts"
import { CheckFailed } from "../errors.ts"
import { envFile } from "./posthog.ts"

const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read and print what would change, writing nothing")
)

const env = Flag.String("env-file").pipe(
  Flag.withDefault("apps/server/.env.production"),
  Flag.withDescription("Where the AXIOM_*_DATASET names are (paper and production share the datasets)")
)

const adminEnv = Flag.String("admin-env-file").pipe(
  Flag.withDefault(".env.local"),
  Flag.withDescription("Where AXIOM_ADMIN_TOKEN is (a token that may manage datasets and dashboards)")
)

const apply = Command.make("apply", { adminEnv, dryRun, env }).pipe(
  Command.withDescription("Check Axiom's datasets and make its dashboards match scripts/axiom/dashboards"),
  Command.withHandler(({ adminEnv, dryRun, env }) =>
    Effect.gen(function*() {
      const missing = (names: string, file: string) =>
        CheckFailed.make({ check: "axiom apply", problems: [`Set ${names} (read from ${file}).`] })
      const token = yield* Config.Redacted("AXIOM_ADMIN_TOKEN").parse(yield* envFile(adminEnv)).pipe(
        Effect.mapError(() => missing("AXIOM_ADMIN_TOKEN", adminEnv))
      )
      const datasets = yield* Config.all({
        traces: Config.String("AXIOM_TRACES_DATASET"),
        logs: Config.String("AXIOM_LOGS_DATASET"),
        metrics: Config.String("AXIOM_METRICS_DATASET")
      }).parse(yield* envFile(env)).pipe(
        Effect.mapError(() => missing("AXIOM_TRACES_DATASET, AXIOM_LOGS_DATASET and AXIOM_METRICS_DATASET", env))
      )

      const dir = (yield* Path.Path).join(import.meta.dirname, "..", "axiom", "dashboards")
      const dashboards = yield* loadDashboards(dir, datasets)
      const report = yield* applyAxiom({ host: AXIOM_API_HOST, token }, { datasets, dashboards }, { dryRun })

      const verb = dryRun ? "would " : ""
      yield* Console.log("axiom:")
      for (const change of report.changes) yield* Console.log(`  ${verb}${change}`)
      yield* Console.log(`  ${report.changes.length} to change, ${report.unchanged} already right`)
      if (report.manual.length === 0) return
      yield* Console.log("\nBy hand:")
      for (const step of report.manual) yield* Console.log(`  - ${step}`)
    })
  )
)

export const axiom = Command.make("axiom").pipe(
  Command.withDescription("Axiom's datasets and dashboards as code (no monitors or notifiers)"),
  Command.withSubcommands([apply])
)
