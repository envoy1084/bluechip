/**
 * Times as automations use them: a time of day (`10:00`), weekdays, and an IANA time zone, with the local clock of
 * a moment in that zone and the zone said as people say it ("New York time").
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/**
 * A time of day, 24-hour: `09:30`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TimeOfDay = Schema.String.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/))

/**
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Weekday = Schema.Literals(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Weekday = typeof Weekday.Type

/**
 * A time zone's IANA name: `America/New_York`.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const TimeZoneName = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64))

/**
 * The zone with this IANA name, if there is one.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const zoneOf = (name: string): Option.Option<DateTime.TimeZone.Named> => DateTime.zoneMakeNamed(name)

/**
 * Minutes since midnight of a time of day.
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const minutesOf = (time: string): number => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

/**
 * The local weekday and minutes since midnight of `now` in `zone` (UTC when the zone is unknown).
 *
 * @stability unstable
 * @category conversions
 * @since 0.0.0
 */
export const localClock = (
  now: DateTime.Utc,
  zone: string
): { readonly weekday: Weekday; readonly minutes: number } => {
  const parts = Option.match(zoneOf(zone), {
    onNone: () => DateTime.toParts(now),
    onSome: (named) => DateTime.toParts(DateTime.setZone(now, named))
  })
  return { weekday: Weekday.literals[parts.weekDay]!, minutes: parts.hour * 60 + parts.minute }
}

/**
 * Whether `minutes` falls between two times of day, `from` included and `to` not; a window past midnight
 * (`22:00` to `07:00`) wraps.
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const isWithin = (minutes: number, from: string, to: string): boolean => {
  const start = minutesOf(from)
  const end = minutesOf(to)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/**
 * A zone as people say it: "New York time", "UTC".
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const zoneName = (zone: string): string => {
  if (zone === "UTC" || zone === "Etc/UTC") return "UTC"
  return `${zone.split("/").at(-1)!.replaceAll("_", " ")} time`
}

const capitalize = (word: string) => word[0]!.toUpperCase() + word.slice(1)

const WORKDAYS: ReadonlyArray<Weekday> = ["monday", "tuesday", "wednesday", "thursday", "friday"]

/**
 * Days as people say them: "every day", "weekdays", "Monday and Thursday".
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const daysName = (days: ReadonlyArray<Weekday>): string => {
  const unique = Weekday.literals.filter((day) => days.includes(day))
  if (unique.length === 0 || unique.length === 7) return "day"
  if (unique.length === 5 && WORKDAYS.every((day) => unique.includes(day))) return "weekday"
  const names = unique.map(capitalize)
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}
