/**
 * The `timeWindow` condition: only between two times of day, on some weekdays, in a time zone.
 *
 * @since 0.0.0
 */
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Condition from "../Condition.ts"
import { Field } from "../Entry.ts"
import { daysName, isWithin, localClock, TimeOfDay, TimeZoneName, Weekday, zoneName, zoneOf } from "../Time.ts"

/**
 * From (included) and to (not), the weekdays (none: every day) and the time zone.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TimeWindowConfig = Schema.Struct({
  from: TimeOfDay,
  to: TimeOfDay,
  days: Schema.Array(Weekday),
  timeZone: TimeZoneName
})

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const timeWindow = Condition.make({
  type: "timeWindow",
  title: "Time window",
  summary: "Only between two times of day, on the days you pick.",
  aliases: ["between", "only in the morning", "only on weekdays", "hours"],
  examples: ["Only between 10:00 and 15:00 on weekdays"],
  config: TimeWindowConfig,
  fields: {
    from: new Field({ label: "From", unit: "time" }),
    to: new Field({ label: "To", unit: "time" }),
    days: new Field({ label: "Days", unit: "weekdays" }),
    timeZone: new Field({ label: "Time zone", unit: "timeZone" })
  },
  defaults: { from: "10:00", to: "15:00", days: [], timeZone: "America/New_York" },
  check: (config) => [
    ...(Option.isNone(zoneOf(config.timeZone)) ? [{ field: "timeZone", message: "Pick a time zone." }] : []),
    ...(config.from === config.to ? [{ field: "to", message: "Pick a different end time." }] : [])
  ],
  describe: (config) =>
    `between ${config.from} and ${config.to} ${zoneName(config.timeZone)}` +
    (config.days.length === 0 || config.days.length === 7 ? "" : ` on ${daysName(config.days)}s`),
  evaluate: (config, facts) => {
    const clock = localClock(facts.now, config.timeZone)
    const day = config.days.length === 0 || config.days.includes(clock.weekday)
    const pass = day && isWithin(clock.minutes, config.from, config.to)
    return { pass, reason: pass ? "Inside its time window." : "Outside its time window." }
  }
})
