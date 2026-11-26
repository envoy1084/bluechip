// Which days the audit log shows: a preset counted back from today, or days you pick, as `YYYY-MM-DD` local days.

export type AuditRangePreset = "any" | "today" | "7d" | "30d" | "custom"

/** The presets, in the menu's order and words. */
export const AUDIT_RANGES: ReadonlyArray<{ readonly value: AuditRangePreset; readonly label: string }> = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" }
]

/** The first and last day shown, both included; `null` leaves that side open. */
export interface AuditDays {
  readonly from: string | null
  readonly to: string | null
}

/** Today in a time zone, as `YYYY-MM-DD`. */
export const localDay = (now: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)

// Calendar arithmetic on the day itself, so it never depends on the machine's zone or daylight saving.
const daysBefore = (day: string, days: number): string => {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, date - days)).toISOString().slice(0, 10)
}

/** The days a preset covers, counted back from `today` (which it includes); a custom range keeps the days picked. */
export const auditDays = (preset: AuditRangePreset, today: string, custom: AuditDays): AuditDays => {
  switch (preset) {
    case "any":
      return { from: null, to: null }
    case "today":
      return { from: today, to: today }
    case "7d":
      return { from: daysBefore(today, 6), to: today }
    case "30d":
      return { from: daysBefore(today, 29), to: today }
    case "custom":
      return custom
  }
}
