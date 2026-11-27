import type { TriggerData } from "@bluechip/domain/automations/Run"
import type { UserId } from "@bluechip/domain/Ids"
import * as Singleton from "effect/cluster/Singleton"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { Automations } from "../Automations.ts"
import { FireAutomation } from "../FireAutomation.ts"

/**
 * The watcher of `schedule` automations: it reads the ones due from the database (`next_run_at`) rather than keeping
 * a sleeping workflow per automation, starts a fire for each scheduled time (its window, so a time fires once), then
 * moves the automation to its next time.
 */
export class ScheduleWatcher extends Context.Service<ScheduleWatcher, {
  /** Fires every schedule due at `now`: everyone's (the watcher), or one user's. */
  readonly runDue: (now: DateTime.Utc, options?: { readonly userId?: UserId | undefined }) => Effect.Effect<void>
}>()("@bluechip/server/ScheduleWatcher") {
  static readonly layer = Layer.effect(
    ScheduleWatcher,
    Effect.gen(function*() {
      const automations = yield* Automations
      const engine = yield* WorkflowEngine.WorkflowEngine

      const runDue = Effect.fn("ScheduleWatcher.runDue")(function*(
        now: DateTime.Utc,
        options: { readonly userId?: UserId | undefined } = {}
      ) {
        const due = yield* automations.due(now, options.userId)
        // A tick with nothing due leaves no trace (`BluechipTracer` drops it).
        if (due.length === 0) yield* Effect.annotateCurrentSpan("bluechip.idle", true)
        for (const row of due) {
          const at = row.nextRunAt!
          const trigger: TriggerData = {
            summary: "Its scheduled time came.",
            symbol: null,
            price: null,
            newsItemId: null
          }
          yield* FireAutomation.execute(
            { automationId: row.id, windowKey: `schedule:${DateTime.formatIso(at)}`, trigger },
            { discard: true }
          ).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
          yield* automations.schedule(row, now)
        }
      })

      return ScheduleWatcher.of({ runDue })
    })
  )

  /** Every 30 seconds, on one runner of the cluster. */
  static readonly watch = Singleton.make(
    "automations.schedules",
    Effect.gen(function*() {
      const watcher = yield* ScheduleWatcher
      yield* DateTime.now.pipe(
        Effect.flatMap((now) => watcher.runDue(now)),
        Effect.catchCause((cause) => Effect.logWarning("Schedule watcher failed", cause)),
        Effect.repeat(Schedule.spaced("30 seconds"))
      )
    })
  )
}
