import { formatDate } from "@bluechip/ui/lib/format"
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
