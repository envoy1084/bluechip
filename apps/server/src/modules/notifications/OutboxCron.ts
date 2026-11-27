import * as Cron from "effect/Cron"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { NotificationFanout } from "./Fanout.ts"

/** Every minute, the outbox rows a stopped process left: written over a minute ago and never handled. */
export const OutboxCron = measuredCron({
  name: "notifications.outbox",
  cron: Cron.parseUnsafe("* * * * *"),
  execute: Effect.gen(function*() {
    const before = DateTime.subtract(yield* DateTime.now, { minutes: 1 })
    const drained = yield* NotificationFanout.use((fanout) => fanout.drain({ before }))
    if (drained > 0) yield* Effect.logInfo(`Notifications: ${drained} left in the outbox made now`)
    // A minute with nothing left over leaves no trace (`BluechipTracer` drops it).
    else yield* Effect.annotateCurrentSpan("bluechip.idle", true)
  }),
  skipIfOlderThan: Duration.minutes(1)
})
