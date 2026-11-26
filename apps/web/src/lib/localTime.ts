import { formatDate, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"

/** The viewer's own time zone: activity is read as "when did I do this", not in market time. */
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const dayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)

/** The day of a moment, as its heading in a list: "Today", "Yesterday", then the date, in the viewer's zone. */
export const dayHeading = (at: DateTime.Utc, now: Date, timeZone = localTimeZone()): string => {
  const date = DateTime.toDateUtc(at)
  const day = dayKey(date, timeZone)
  if (day === dayKey(now, timeZone)) return "Today"
  if (day === dayKey(new Date(now.getTime() - 86_400_000), timeZone)) return "Yesterday"
  return formatDate(date, { timeZone, time: false })
}

/** The viewer's clock time of a moment, named as theirs: "02:00 your time". */
export const yourTime = (at: Date, timeZone = localTimeZone()): string => `${formatTime(at, { timeZone })} your time`

/** A day and time in the viewer's zone, named as theirs: "Sat 28 Nov, 02:00 your time". */
export const yourDateTime = (at: Date, timeZone = localTimeZone()): string =>
  `${formatDate(at, { timeZone })} your time`

/** The next midnight UTC after `now`, when agents' daily limits start again onchain. */
export const nextDailyReset = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))

/** When the daily limits start again, in the viewer's time first: "05:30 your time, midnight UTC". */
export const dailyResetText = (now: Date, timeZone = localTimeZone()): string =>
  `${yourTime(nextDailyReset(now), timeZone)}, midnight UTC`
