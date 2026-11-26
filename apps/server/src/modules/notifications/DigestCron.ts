import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { Reminders } from "./Reminders.ts"

/** Hourly: the daily digest of each user for whom it is 08:00 in their time zone. */
export const DigestCron = ClusterCron.make({
  name: "notifications.digest",
  cron: Cron.parseUnsafe("0 * * * *"),
  execute: Reminders.use((reminders) => reminders.digest()),
  skipIfOlderThan: Duration.hours(1)
})
