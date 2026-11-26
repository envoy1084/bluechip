import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { Reminders } from "./Reminders.ts"

/** Waiting trades, expiring approvals and ending sessions, every 5 minutes. */
export const ReminderCron = ClusterCron.make({
  name: "notifications.remind",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Reminders.use((reminders) => reminders.remind()),
  skipIfOlderThan: Duration.minutes(5)
})
