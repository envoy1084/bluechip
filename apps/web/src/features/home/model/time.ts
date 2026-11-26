// When things happen, as home says it in the viewer's own time.
import { formatDate, formatTime } from "@bluechip/ui/lib/format"

const DAY = 86_400_000

const dayKey = (date: Date, zone: string) => formatDate(date, { timeZone: zone, time: false })

/** "Today", "Tomorrow", else "Mon 30 Nov". */
export const dayWord = (at: Date, now: Date, zone: string): string => {
  if (dayKey(at, zone) === dayKey(now, zone)) return "Today"
  if (dayKey(at, zone) === dayKey(new Date(now.getTime() + DAY), zone)) return "Tomorrow"
  return dayKey(at, zone)
}

/** "at 14:30" today, "tomorrow at 14:30", else "on Mon 30 Nov at 14:30". */
export const whenText = (at: Date, now: Date, zone: string): string => {
  const day = dayWord(at, now, zone)
  const time = formatTime(at, { timeZone: zone })
  if (day === "Today") return `at ${time}`
  return day === "Tomorrow" ? `tomorrow at ${time}` : `on ${day} at ${time}`
}

/** How long until a moment: "in 40 min", "in 5 h", "in 3 days"; "now" once it's here. */
export const untilText = (at: Date, now: Date): string => {
  const minutes = (at.getTime() - now.getTime()) / 60_000
  if (minutes < 1) return "now"
  if (minutes < 60) return `in ${Math.round(minutes)} min`
  if (minutes < 24 * 60) return `in ${Math.round(minutes / 60)} h`
  const days = Math.round(minutes / (24 * 60))
  return days === 1 ? "tomorrow" : `in ${days} days`
}
