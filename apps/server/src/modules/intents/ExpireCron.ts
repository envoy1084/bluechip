import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { IntentStore } from "./IntentStore.ts"

/** Approvals, signatures and waiting trades left open past their time, every 5 minutes. */
export const ExpireIntentsCron = ClusterCron.make({
  name: "intents.expire",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: IntentStore.use((store) => store.expire()),
  skipIfOlderThan: Duration.minutes(5)
})
