import * as Config from "effect/Config"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Reconciliation } from "./Reconciliation.ts"

/**
 * Every account's balances against its ledger every 5 minutes; a run more than 5 minutes late is skipped. Off when
 * `RECONCILE_ENABLED` (or `SCHEDULES_ENABLED`, as in tests) is `false`.
 */
export const ReconcileCron = Layer.unwrap(Effect.gen(function*() {
  const enabled = yield* Config.Boolean("RECONCILE_ENABLED").pipe(Config.withDefault(true))
  if (!enabled) return Layer.empty

  return measuredCron({
    name: "ledger.reconcile",
    cron: Cron.parseUnsafe("*/5 * * * *"),
    execute: Effect.gen(function*() {
      const reconciliation = yield* Reconciliation
      const { checked, skipped } = yield* reconciliation.check()
      yield* Effect.annotateCurrentSpan({ checked, skipped })
    }).pipe(Effect.withSpan("ReconcileCron")),
    skipIfOlderThan: Duration.minutes(5)
  })
}))
