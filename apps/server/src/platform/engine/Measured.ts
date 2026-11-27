import * as Cause from "effect/Cause"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { count, CronLag, CronRuns, record, WorkflowDuration } from "../telemetry/Metrics.ts"

/**
 * `ClusterCron.make` with each run measured: `bluechip.cron.runs` by outcome and `bluechip.cron.lag`, from the run's
 * scheduled time to its start.
 */
export const measuredCron = <E, R>(options: Parameters<typeof ClusterCron.make<E, R>>[0]) =>
  ClusterCron.make({
    ...options,
    execute: Effect.gen(function*() {
      const scheduled = yield* ClusterCron.CurrentScheduledTime
      const lag = Duration.toSeconds(DateTime.distance(scheduled, yield* DateTime.now))
      yield* record(CronLag, Math.max(0, lag), { cron: options.name })
      const exit = yield* Effect.exit(options.execute)
      yield* count(CronRuns, { cron: options.name, outcome: Exit.isSuccess(exit) ? "ok" : "failed" })
      return yield* exit
    })
  })

/**
 * A workflow's body with each run of it measured (`bluechip.engine.workflow.duration`): `done`, `failed`, or
 * `suspended` when it stops to wait (a durable sleep, an approval) and resumes later as another run.
 */
export const measuredWorkflow = (workflow: string) => <A, E, R>(body: Effect.Effect<A, E, R>) =>
  Effect.gen(function*() {
    const [took, exit] = yield* Effect.timed(Effect.exit(body))
    const outcome = Exit.isSuccess(exit) ? "done" : Cause.hasInterruptsOnly(exit.cause) ? "suspended" : "failed"
    yield* record(WorkflowDuration, Duration.toSeconds(took), { workflow, outcome })
    return yield* exit
  })
