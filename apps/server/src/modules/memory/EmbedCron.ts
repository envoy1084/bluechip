import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { RecallIndex } from "./RecallIndex.ts"

/**
 * The re-embed job, every 5 minutes: recall entries whose embedding failed when they were written, and every entry
 * after a change of embedding model.
 */
export const RecallEmbedCron = ClusterCron.make({
  name: "memory.embed",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Effect.asVoid(RecallIndex.use((index) => index.embedPending())),
  skipIfOlderThan: Duration.minutes(5)
})
