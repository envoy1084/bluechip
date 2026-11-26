// The top of home in words: the day, a greeting by the time of day, and where the US market stands, all in the
// viewer's own time.
import type { MarketStatus } from "@bluechip/domain/market/Market"
import * as DateTime from "effect/DateTime"
import { SESSION_LABEL } from "../../../lib/marketSession.ts"
import { whenText } from "./time.ts"

const hourIn = (now: Date, zone: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).format(now))

/** "Good morning" before noon, "Good afternoon" until 6 pm, then "Good evening", with your first name when known. */
export const greeting = (now: Date, displayName: string | null, zone: string): string => {
  const hour = hourIn(now, zone)
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const first = displayName?.trim().split(/\s+/)[0] ?? ""
  return first === "" ? part : `${part}, ${first}`
}

/** "Friday 27 November". */
export const todayLabel = (now: Date, zone: string): string =>
  now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: zone })

/** Where the US market stands, as a sentence: open until its close, an extended session, or prices paused. */
export const marketLine = (status: MarketStatus, now: Date, zone: string): string => {
  // In your time, named once, as every time in bluechip is said.
  const when = (at: DateTime.Utc) => `${whenText(DateTime.toDateUtc(at), now, zone)} your time`

  switch (status.session) {
    case "regular":
      return status.closesAt === null
        ? "The US market is open."
        : `The US market is open and closes ${when(status.closesAt)}.`
    case "paused":
      return `Prices are paused${status.pausedFor === null ? "" : ` for the ${status.pausedFor}`} and start again ${
        when(status.changesAt)
      }.`
    default:
      return `${SESSION_LABEL[status.session]} trading now. The market opens ${when(status.opensAt)}.`
  }
}
