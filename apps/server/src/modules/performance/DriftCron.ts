import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Drift } from "./Drift.ts"

/**
 * Every hour, each active agent with a target mix: how far its account is from that mix, for its drift history. A
 * run more than half an hour late is skipped.
 */
export const DriftCron = measuredCron({
  name: "performance.drift",
  cron: Cron.parseUnsafe("10 * * * *"),
  execute: Drift.use((drift) => drift.measure()).pipe(Effect.withSpan("DriftCron")),
  skipIfOlderThan: Duration.minutes(30)
})
