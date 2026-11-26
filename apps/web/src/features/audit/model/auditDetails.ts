// An audit entry's time and record as its row shows them: when, at a glance and exactly, and every field it holds.
import type { AuditEvent } from "@bluechip/domain/audit/Audit"
import { formatRelative, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { auditField } from "./auditText.ts"

/** The row's time under its day: "Just now", "12 min ago", "3 h ago" within a day, then the time, "22:03". */
export const auditWhen = (at: DateTime.Utc, now: Date, timeZone: string): string => {
  const date = DateTime.toDateUtc(at)
  return now.getTime() - date.getTime() < 86_400_000 ?
    formatRelative(date, now, { timeZone }) :
    formatTime(date, { timeZone })
}

/** The exact moment, to the second, in the viewer's zone: "Thu 26 Nov 2026, 22:03:15". */
export const auditExactTime = (at: DateTime.Utc, timeZone: string): string => {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  })
  const p = Object.fromEntries(format.formatToParts(DateTime.toDateUtc(at)).map((part) => [part.type, part.value]))
  return `${p["weekday"]} ${p["day"]} ${p["month"]} ${p["year"]}, ${p["hour"]}:${p["minute"]}:${p["second"]}`
}

/** The entry's record in words, for its details: when exactly, and the agent it concerns by name. */
export const auditRecord = (
  event: AuditEvent,
  timeZone: string,
  agentName: (id: string) => string | undefined = () => undefined
): ReadonlyArray<{ readonly label: string; readonly value: string }> => [
  { label: "When", value: auditExactTime(event.at, timeZone) },
  ...(event.agentId === null ?
    [] :
    [{ label: "Agent", value: agentName(event.agentId) ?? auditField(event, "name") ?? "An agent" }])
]

const SUBJECTS: Readonly<Record<string, string>> = {
  intent: "trade",
  agent: "agent",
  automation: "automation",
  passkey: "passkey",
  session: "device",
  recovery: "recovery",
  recoveryKey: "recovery key",
  channelLink: "chat"
}

/**
 * The ids an entry carries, each named, for copying rather than reading: the entry's own, what it was about, and the
 * agent it concerns when that's another.
 */
export const auditIds = (event: AuditEvent): ReadonlyArray<{ readonly label: string; readonly id: string }> => {
  const subject = SUBJECTS[event.subjectType] ?? "subject"
  return [
    { label: "Entry", id: event.id },
    { label: subject[0]!.toUpperCase() + subject.slice(1), id: event.subjectId },
    ...(event.agentId === null || event.agentId === event.subjectId ? [] : [{ label: "Agent", id: event.agentId }])
  ]
}

/** The entry's extra data as indented JSON, or `null` when it carries none. */
export const auditData = (event: AuditEvent): string | null => {
  const data = event.data
  if (data === null) return null
  if (typeof data === "object" && Object.keys(data).length === 0) return null
  return JSON.stringify(data, null, 2)
}
