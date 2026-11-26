// The portfolio chart's ranges: what its Value and Profit views can show of the data the server keeps.
import type { PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { formatDate } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { usdcDollars } from "../../../lib/amounts.ts"
import { localTimeZone } from "../../../lib/localTime.ts"

const DAY = 24 * 60 * 60 * 1000

// A tick has room for a day, not a time: "26 Nov".
const dayMonth = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(at)

// The value's change counts deposits and withdrawals too, so it says so rather than read as a return.
const VALUE_NOTE = "Change in value, including deposits and withdrawals"

/**
 * The value history (a snapshot every 4 hours over 30 days) as ranges: the past week, then the past 30 days, in the
 * viewer's time, ticked by day. The week is offered only when it has a line of its own and is shorter than the month.
 * Each says its change includes deposits.
 */
export const valueRanges = (
  points: ReadonlyArray<{ readonly at: DateTime.Utc; readonly value: bigint }>,
  timeZone = localTimeZone()
): ReadonlyArray<PortfolioRange> => {
  const plotted = points.map((point) => ({
    value: usdcDollars(point.value),
    label: formatDate(DateTime.toDateUtc(point.at), { timeZone }),
    tick: dayMonth(DateTime.toDateUtc(point.at), timeZone),
    at: DateTime.toEpochMillis(point.at)
  }))
  const since = (plotted.at(-1)?.at ?? 0) - 7 * DAY
  const week = plotted.filter((point) => point.at >= since)
  const month: PortfolioRange = {
    id: "1M",
    description: "Past 30 days",
    changeNote: VALUE_NOTE,
    points: plotted.map(withoutTime)
  }

  if (week.length < 2 || week.length === plotted.length) return [month]
  return [{ id: "1W", description: "Past week", changeNote: VALUE_NOTE, points: week.map(withoutTime) }, month]
}

/**
 * Each day's profit and loss since the first trade as ranges: the past 30 days, then all of it. The 30 days are offered
 * only once there is more than that.
 */
export const profitRanges = (
  series: ReadonlyArray<{ readonly day: string; readonly total: bigint }>
): ReadonlyArray<PortfolioRange> => {
  const plotted = series.map((point) => {
    const at = new Date(`${point.day}T12:00:00Z`)
    return { value: usdcDollars(point.total), label: formatDate(at, { time: false }), at: at.getTime() }
  })
  const since = (plotted.at(-1)?.at ?? 0) - 29 * DAY
  const month = plotted.filter((point) => point.at >= since)
  const all: PortfolioRange = { id: "All", description: "Since your first trade", points: plotted.map(withoutTime) }

  if (month.length < 2 || month.length === plotted.length) return [all]
  return [{ id: "1M", description: "Past 30 days", points: month.map(withoutTime) }, all]
}

const withoutTime = (
  { label, tick, value }: { readonly value: number; readonly label: string; readonly tick?: string }
) => (tick === undefined ? { value, label } : { value, label, tick })
