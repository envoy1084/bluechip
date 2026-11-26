import { STALE_GUESS_DAYS } from "@bluechip/domain/assistant/Memory"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { Memories } from "./Memories.ts"

/**
 * Stale memories, every day at 03:00 UTC: guesses the user never confirmed are dropped after 30 days. Confirmed
 * memories aren't deleted; recall weighs them down the longer they go unused.
 */
export const MemoryDecayCron = ClusterCron.make({
  name: "memory.decay",
  cron: Cron.parseUnsafe("0 3 * * *"),
  execute: Effect.asVoid(Memories.use((memories) => memories.dropStale(STALE_GUESS_DAYS))),
  skipIfOlderThan: Duration.hours(1)
})
