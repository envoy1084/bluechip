import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Reminders } from "./Reminders.ts"

/** Waiting trades, expiring approvals and ending sessions, every 5 minutes. */
export const ReminderCron = measuredCron({
  name: "notifications.remind",
  cron: Cron.parseUnsafe("*/5 * * * *"),
  execute: Reminders.use((reminders) => reminders.remind()),
  skipIfOlderThan: Duration.minutes(5)
})
