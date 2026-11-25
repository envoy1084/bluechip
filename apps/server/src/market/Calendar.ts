import { MarketStatus, type PriceStatus } from "@bluechip/domain/market/Market"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Option from "effect/Option"

// NYSE's holidays and 1:00 pm early closes, from "NYSE Group Announces 2026, 2027 and 2028 Holiday and Early Closings
// Calendar" (ICE, 2025-12-23). Dates are New York calendar days. Extend this when NYSE publishes 2029.
const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
  "2028-01-17",
  "2028-02-21",
  "2028-04-14",
  "2028-05-29",
  "2028-06-19",
  "2028-07-04",
  "2028-09-04",
  "2028-11-23",
  "2028-12-25"
])
const EARLY_CLOSES = new Set(["2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24"])

const NEW_YORK = DateTime.zoneMakeNamedUnsafe("America/New_York")

interface Day {
  readonly year: number
  readonly month: number
  readonly day: number
}

const key = ({ day, month, year }: Day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

const newYorkTime = (day: Day, hours: number, minutes: number): DateTime.Utc =>
  DateTime.toUtc(Option.getOrThrow(
    DateTime.makeZoned({ ...day, hour: hours, minute: minutes, second: 0, millisecond: 0 }, {
      timeZone: NEW_YORK,
      adjustForTimeZone: true
    })
  ))

const nextDay = (day: Day): Day => {
  const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

/** The day's regular session in New York, or why there is none. */
const session = (day: Day): { readonly opens: DateTime.Utc; readonly closes: DateTime.Utc } | "weekend" | "holiday" => {
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()
  if (weekday === 0 || weekday === 6) return "weekend"
  if (HOLIDAYS.has(key(day))) return "holiday"
  return { opens: newYorkTime(day, 9, 30), closes: newYorkTime(day, EARLY_CLOSES.has(key(day)) ? 13 : 16, 0) }
}

const nextOpen = (from: Day): DateTime.Utc => {
  let day = from
  // Ten days covers the longest run of closed days (a holiday weekend).
  for (let step = 0; step < 10; step++) {
    const today = session(day)
    if (typeof today !== "string") return today.opens
    day = nextDay(day)
  }
  return newYorkTime(day, 9, 30)
}

/**
 * Whether the US market is open at `now` (NYSE regular hours, holidays and early closes), and when that changes.
 */
export const marketStatus = (now: DateTime.Utc): MarketStatus => {
  const parts = DateTime.toParts(DateTime.setZone(now, NEW_YORK))
  const today: Day = { year: parts.year, month: parts.month, day: parts.day }
  const todays = session(today)
  if (typeof todays === "string") {
    return new MarketStatus({ state: "closed", reason: todays, opensAt: nextOpen(today), closesAt: null, asOf: now })
  }
  if (DateTime.isLessThan(now, todays.opens)) {
    return new MarketStatus({ state: "closed", reason: "beforeOpen", opensAt: todays.opens, closesAt: null, asOf: now })
  }
  if (DateTime.isLessThan(now, todays.closes)) {
    return new MarketStatus({ state: "open", reason: null, opensAt: null, closesAt: todays.closes, asOf: now })
  }
  return new MarketStatus({
    state: "closed",
    reason: "afterClose",
    opensAt: nextOpen(nextDay(today)),
    closesAt: null,
    asOf: now
  })
}

// Coinbase's stock feeds run 24/5 (extended and overnight sessions on weekdays) and update on a 0.5% move or at
// least every 24 hours.
const HEARTBEAT = Duration.hours(24)

/**
 * How much a feed's answer can be trusted: the last close on weekends and holidays (the feeds pause), otherwise
 * `live` while the feed keeps its heartbeat (also outside regular hours, as the feeds run 24/5) and `stale` once it
 * misses it.
 */
export const priceStatus = (market: MarketStatus, updatedAt: DateTime.Utc): PriceStatus => {
  if (market.reason === "weekend" || market.reason === "holiday") return "closed"
  return Duration.isGreaterThan(DateTime.distance(updatedAt, market.asOf), HEARTBEAT) ? "stale" : "live"
}
