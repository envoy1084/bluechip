import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { RecallIndex } from "./RecallIndex.ts"

/**
 * The re-embed job, every 5 minutes: recall entries whose embedding failed when they were written, and every entry
 * after a change of embedding model.
 */
export const RecallEmbedCron = measuredCron({
  name: "memory.embed",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Effect.asVoid(RecallIndex.use((index) => index.embedPending())),
  skipIfOlderThan: Duration.minutes(5)
})
