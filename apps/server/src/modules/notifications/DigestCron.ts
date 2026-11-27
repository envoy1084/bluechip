import * as Cron from "effect/Cron"
import * as Duration from "effect/Duration"
import { measuredCron } from "../../platform/engine/Measured.ts"
import { Reminders } from "./Reminders.ts"

/** Hourly: the daily digest of each user for whom it is 08:00 in their time zone. */
export const DigestCron = measuredCron({
  name: "notifications.digest",
  cron: Cron.parseUnsafe("0 * * * *"),
  execute: Reminders.use((reminders) => reminders.digest()),
  skipIfOlderThan: Duration.hours(1)
})
