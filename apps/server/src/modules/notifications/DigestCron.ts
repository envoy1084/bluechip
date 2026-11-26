import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { Reminders } from "./Reminders.ts"

/** Each user's daily digest of the day before, at 08:00 UTC. */
export const DigestCron = ClusterCron.make({
  name: "notifications.digest",
  cron: Cron.parseUnsafe("0 8 * * *"),
  execute: Reminders.use((reminders) => reminders.digest()),
  skipIfOlderThan: Duration.hours(1)
})
