/**
 * The `schedule` trigger: on chosen weekdays at a time of day in a time zone. The schedule watcher reads the
 * automations due from the database (`next_run_at`); each scheduled time is its own window.
 *
 * @since 0.0.0
 */
import * as Cron from "effect/Cron"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Field } from "../Entry.ts"
import { daysName, minutesOf, TimeOfDay, TimeZoneName, Weekday, zoneName, zoneOf } from "../Time.ts"
import * as Trigger from "../Trigger.ts"

/**
 * The weekdays (none: every day), the time of day and the time zone it is read in.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const ScheduleConfig = Schema.Struct({
  days: Schema.Array(Weekday),
  time: TimeOfDay,
  timeZone: TimeZoneName
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type ScheduleConfig = typeof ScheduleConfig.Type

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const schedule = Trigger.make({
  type: "schedule",
  watcher: "schedule",
  marketHours: false,
  asks: false,
  title: "On a schedule",
  summary: "On the days and at the time you pick.",
  aliases: ["every week", "every day", "recurring", "weekly", "daily", "dollar cost averaging", "DCA"],
  examples: ["Every Monday buy $50 of Apple", "Each weekday at 3 pm buy $10 of NVIDIA"],
  config: ScheduleConfig,
  fields: {
    days: new Field({ label: "Days", unit: "weekdays" }),
    time: new Field({ label: "Time", unit: "time" }),
    timeZone: new Field({ label: "Time zone", unit: "timeZone" })
  },
  defaults: { days: ["monday"], time: "10:00", timeZone: "America/New_York" },
  check: (config) => [
    ...(Option.isNone(zoneOf(config.timeZone)) ? [{ field: "timeZone", message: "Pick a time zone." }] : []),
    ...(new Set(config.days).size === config.days.length ? [] : [{ field: "days", message: "Pick each day once." }])
  ],
  describe: (config) => `every ${daysName(config.days)} at ${config.time} ${zoneName(config.timeZone)}`
})

/**
 * The schedule as a `Cron` in its time zone.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const cronOf = (config: ScheduleConfig): Cron.Cron => {
  const minutes = minutesOf(config.time)
  return Cron.make({
    minutes: [minutes % 60],
    hours: [Math.floor(minutes / 60)],
    days: [],
    months: [],
    weekdays: config.days.map((day) => Weekday.literals.indexOf(day)),
    tz: Option.getOrUndefined(zoneOf(config.timeZone))
  })
}

/**
 * The first scheduled time after `after`.
 *
 * **Example** (Every Monday at 10:00 New York time, from a Sunday)
 *
 * ```ts import.meta.vitest
 * import { nextRun } from "@bluechip/domain/automations/triggers/Schedule"
 * import * as DateTime from "effect/DateTime"
 *
 * const config = { days: ["monday"], time: "10:00", timeZone: "America/New_York" } as const
 * DateTime.formatIso(nextRun(config, DateTime.makeUnsafe("2026-11-29T12:00:00Z"))) // => "2026-11-30T15:00:00.000Z"
 * ```
 *
 * @stability unstable
 * @category scheduling
 * @since 0.0.0
 */
export const nextRun = (config: ScheduleConfig, after: DateTime.Utc): DateTime.Utc =>
  DateTime.makeUnsafe(Cron.next(cronOf(config), after))
