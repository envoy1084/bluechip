import { type MarketSession, MarketStatus, type PriceStatus } from "@bluechip/domain/market/Market"
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

const previousDay = (day: Day): Day => {
  const previous = new Date(Date.UTC(day.year, day.month - 1, day.day - 1))
  return { year: previous.getUTCFullYear(), month: previous.getUTCMonth() + 1, day: previous.getUTCDate() }
}

const nextDay = (day: Day): Day => {
  const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

/** Why a New York day has no trading, or `undefined` on a trading day. */
const closedFor = (day: Day): "weekend" | "holiday" | undefined => {
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()
  if (weekday === 0 || weekday === 6) return "weekend"
  return HOLIDAYS.has(key(day)) ? "holiday" : undefined
}

interface Session {
  readonly session: Exclude<MarketSession, "paused">
  readonly start: DateTime.Utc
  readonly end: DateTime.Utc
}

/**
 * A trading day's sessions, as Chainlink's 24/5 feeds follow them: overnight from 8 pm the evening before, pre-market
 * from 4 am, regular 9:30 am to 4 pm (1 pm on early closes), after-hours until 8 pm (5 pm after an early close).
 */
const sessionsOf = (day: Day): ReadonlyArray<Session> => {
  const earlyClose = EARLY_CLOSES.has(key(day))
  const close = newYorkTime(day, earlyClose ? 13 : 16, 0)
  const evening = newYorkTime(previousDay(day), 20, 0)

  return [
    { session: "overnight", start: evening, end: newYorkTime(day, 4, 0) },
    { session: "preMarket", start: newYorkTime(day, 4, 0), end: newYorkTime(day, 9, 30) },
    { session: "regular", start: newYorkTime(day, 9, 30), end: close },
    { session: "afterHours", start: close, end: newYorkTime(day, earlyClose ? 17 : 20, 0) }
  ]
}

/** The sessions of the trading days from `day` on, enough to reach past the longest pause (a holiday weekend). */
const upcomingSessions = (day: Day): ReadonlyArray<Session> => {
  const sessions: Array<Session> = []
  let current = day

  for (let step = 0; step < 10; step++) {
    if (closedFor(current) === undefined) sessions.push(...sessionsOf(current))
    current = nextDay(current)
  }

  return sessions
}

/**
 * The market's session at `now`: regular, pre-market, after-hours or overnight while prices move (Sunday 8 pm to
 * Friday 8 pm New York, NYSE holidays and early closes included), otherwise paused, with when that changes.
 */
export const marketStatus = (now: DateTime.Utc): MarketStatus => {
  const parts = DateTime.toParts(DateTime.setZone(now, NEW_YORK))
  const today: Day = { year: parts.year, month: parts.month, day: parts.day }
  const sessions = upcomingSessions(today)

  const current = sessions.find(({ end, start }) => !DateTime.isLessThan(now, start) && DateTime.isLessThan(now, end))
  const next = sessions.find(({ start }) => DateTime.isGreaterThan(start, now))!
  const nextOpen = sessions.find(({ session, start }) => session === "regular" && DateTime.isGreaterThan(start, now))!

  if (current !== undefined) {
    const regular = current.session === "regular"
    return new MarketStatus({
      session: current.session,
      pausedFor: null,
      changesAt: current.end,
      opensAt: regular ? current.start : nextOpen.start,
      closesAt: regular ? current.end : null,
      asOf: now
    })
  }

  // A pause belongs to the first day without trading: today, or tomorrow once today's sessions are over.
  const pausedDay = closedFor(today) === undefined ? nextDay(today) : today
  return new MarketStatus({
    session: "paused",
    pausedFor: closedFor(pausedDay) ?? "weekend",
    changesAt: next.start,
    opensAt: nextOpen.start,
    closesAt: null,
    asOf: now
  })
}

// Coinbase's stock feeds update on a 0.5% move or at least every 24 hours while they run.
const HEARTBEAT = Duration.hours(24)

/**
 * How much a feed's answer can be trusted: `paused` while prices are (weekends, holidays), otherwise `live` while the
 * feed keeps its heartbeat and `stale` once it misses it.
 */
export const priceStatus = (market: MarketStatus, updatedAt: DateTime.Utc): PriceStatus => {
  if (market.session === "paused") return "paused"
  return Duration.isGreaterThan(DateTime.distance(updatedAt, market.asOf), HEARTBEAT) ? "stale" : "live"
}
