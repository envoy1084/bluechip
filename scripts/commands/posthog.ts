import { Config, ConfigProvider, Console, Effect, FileSystem } from "effect"
import { Command, Flag } from "effect/cli"

import { CheckFailed } from "../errors.ts"
import { appHost } from "../posthog/Api.ts"
import { applyPostHog } from "../posthog/Apply.ts"
import { desired } from "../posthog/Desired.ts"

/** Reads config from `file` (an env file, when it exists), then the process environment. */
export const envFile = Effect.fn("envFile")(function*(file: string) {
  const fs = yield* FileSystem.FileSystem
  if (!(yield* fs.exists(file))) return ConfigProvider.fromEnv()
  return ConfigProvider.orElse(
    ConfigProvider.fromDotEnvContents(yield* fs.readFileString(file)),
    ConfigProvider.fromEnv()
  )
})

const project = Flag.Literals("project", ["paper", "production"]).pipe(
  Flag.withDescription("The PostHog project: paper or production")
)

const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Read and print what would change, writing nothing")
)

const env = Flag.String("env-file").pipe(
  Flag.optional,
  Flag.withDescription("Where POSTHOG_HOST and the keys are (default apps/server/.env.<project>)")
)

const apply = Command.make("apply", { project, dryRun, env }).pipe(
  Command.withDescription("Make a PostHog project's settings, cohorts, insights and dashboards match bluechip's"),
  Command.withHandler(({ dryRun, env, project }) =>
    Effect.gen(function*() {
      const file = env._tag === "Some" ? env.value : `apps/server/.env.${project}`
      const config = yield* Config.all({
        host: Config.String("POSTHOG_HOST"),
        projectKey: Config.Redacted("POSTHOG_PROJECT_API_KEY"),
        personalKey: Config.Redacted("POSTHOG_PERSONAL_API_KEY")
      }).parse(yield* envFile(file)).pipe(
        Effect.mapError(() =>
          CheckFailed.make({
            check: "posthog apply",
            problems: [`Set POSTHOG_HOST, POSTHOG_PROJECT_API_KEY and POSTHOG_PERSONAL_API_KEY (read from ${file}).`]
          })
        )
      )

      const report = yield* applyPostHog(
        { host: appHost(config.host), key: config.personalKey },
        config.projectKey,
        desired(project),
        { dryRun }
      )

      const verb = dryRun ? "would " : ""
      yield* Console.log(`posthog: ${report.project.name} (${report.project.id})`)
      for (const change of report.changes) yield* Console.log(`  ${verb}${change}`)
      yield* Console.log(`  ${report.changes.length} to change, ${report.unchanged} already right`)
      yield* Console.log("\nBy hand:")
      for (const step of report.manual) yield* Console.log(`  - ${step}`)
    })
  )
)

export const posthog = Command.make("posthog").pipe(
  Command.withDescription("PostHog's configuration as code"),
  Command.withSubcommands([apply])
)
