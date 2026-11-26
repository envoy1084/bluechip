// When a filled trade's receipt says it filled: "Today at 09:41", "Yesterday at 16:02", "On 21 Nov at 10:00".
import { formatDate, formatTime } from "@bluechip/ui/lib/format"

const dayOf = (date: Date, zone: string) => formatDate(date, { timeZone: zone, time: false })

/** When it filled, as a phrase that can follow who sent it, in the viewer's `zone`. */
export const receiptWhen = (at: Date, now: Date, zone: string): string => {
  const time = formatTime(at, { timeZone: zone })
  if (dayOf(at, zone) === dayOf(now, zone)) return `Today at ${time}`
  if (dayOf(at, zone) === dayOf(new Date(now.getTime() - 24 * 60 * 60 * 1000), zone)) return `Yesterday at ${time}`
  const [, day, month] = dayOf(at, zone).split(" ")
  return `On ${day} ${month} at ${time}`
}
