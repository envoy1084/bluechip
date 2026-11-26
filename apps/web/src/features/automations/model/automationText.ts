// How automations read on screen: where one stands, how a run ended, what a model answered, and each choice of the
// editor in words.
import type { Automation, AutomationProblem, AutomationStatus } from "@bluechip/domain/automations/Automation"
import type { JudgmentAnswer, JudgmentPreset } from "@bluechip/domain/automations/conditions/Judgment"
import type { RunOutcome } from "@bluechip/domain/automations/Run"
import type { Weekday } from "@bluechip/domain/automations/Time"
import { Conflict, InvalidAutomation, NotFound } from "@bluechip/domain/Errors"
import { formatDate, formatRelative } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"

export const STATUS: Readonly<
  Record<AutomationStatus, { readonly label: string; readonly tone: "done" | "quiet" | "waiting" }>
> = {
  active: { label: "Active", tone: "done" },
  paused: { label: "Paused", tone: "quiet" },
  done: { label: "Done", tone: "quiet" },
  expired: { label: "Ended", tone: "quiet" },
  deleted: { label: "Deleted", tone: "quiet" }
}

export const OUTCOME: Readonly<
  Record<RunOutcome, { readonly label: string; readonly tone: "done" | "quiet" | "waiting" | "warn" }>
> = {
  proposed: { label: "Traded", tone: "done" },
  asked: { label: "Asked you", tone: "waiting" },
  notified: { label: "Told you", tone: "done" },
  skipped: { label: "Skipped", tone: "quiet" },
  failed: { label: "Didn't run", tone: "warn" }
}

export const CREATED_BY: Readonly<Record<"owner" | "assistant" | "template", string>> = {
  owner: "You set it up",
  assistant: "Set up in a chat",
  template: "Came with its agent"
}

const PRESETS: Readonly<Record<JudgmentPreset, string>> = {
  materiallyNegative: "Bad news",
  materiallyPositive: "Good news",
  earningsRelated: "About earnings"
}

/** A model's answer in words: "Yes, 82% sure", then its reason. */
export const judgmentText = (answer: JudgmentAnswer): string =>
  `${answer.verdict ? "Yes" : "No"}, ${Math.round(answer.confidence * 100)}% sure`

/** One choice of a `choice` field in words; some depend on the rest of the entry (a fall is from a high). */
export const choiceLabel = (type: string, field: string, value: string, config: unknown): string => {
  const direction = (config as { readonly direction?: string }).direction
  switch (`${type}.${field}`) {
    case "priceMove.reference":
      return {
        previousClose: "Its last close",
        open: "Today's open",
        trailingHigh: direction === "up" ? "Its low" : "Its high",
        price: "Its price now"
      }[value] ?? value
    case "priceMove.direction":
      return value === "down" ? "Falls" : "Rises"
    case "priceCross.direction":
      return value === "above" ? "Goes above" : "Goes below"
    case "portfolio.direction":
      return value === "below" ? "Falls under" : "Grows over"
    case "portfolio.measure":
      return value === "cash" ? "Cash" : "A holding"
    case "judgment.preset":
      return PRESETS[value as JudgmentPreset] ?? value
    default:
      return value
  }
}

/** Waits between two fires the settings offer, in minutes. */
export const COOLDOWNS: ReadonlyArray<{ readonly minutes: number; readonly label: string }> = [
  { minutes: 0, label: "No wait" },
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 240, label: "4 hours" },
  { minutes: 24 * 60, label: "1 day" },
  { minutes: 7 * 24 * 60, label: "1 week" }
]

export const WEEKDAYS: ReadonlyArray<{ readonly day: Weekday; readonly label: string; readonly name: string }> = [
  { day: "monday", label: "Mon", name: "Monday" },
  { day: "tuesday", label: "Tue", name: "Tuesday" },
  { day: "wednesday", label: "Wed", name: "Wednesday" },
  { day: "thursday", label: "Thu", name: "Thursday" },
  { day: "friday", label: "Fri", name: "Friday" },
  { day: "saturday", label: "Sat", name: "Saturday" },
  { day: "sunday", label: "Sun", name: "Sunday" }
]

/** The time zones a time can be in: the market's, yours (when it's another), and UTC. */
export const timeZones = (local: string): ReadonlyArray<{ readonly zone: string; readonly label: string }> => [
  { zone: "America/New_York", label: "New York (market time)" },
  ...(local === "America/New_York" || local === "UTC" || local === "Etc/UTC" ?
    [] :
    [{ zone: local, label: `${local.split("/").at(-1)!.replaceAll("_", " ")} (your time)` }]),
  { zone: "UTC", label: "UTC" }
]

/** How often it fired: "Not yet", "Once", "12 times". */
export const firesText = (fires: number): string => fires === 0 ? "Not yet" : fires === 1 ? "Once" : `${fires} times`

const PARTS: Readonly<Record<AutomationProblem["part"], string>> = {
  name: "Name",
  trigger: "When",
  conditions: "Only if",
  action: "Then",
  settings: "Settings"
}

/** A problem with the part it's about: "Then: This agent only buys.", "Only if (condition 2): Pick a price above $0." */
export const problemText = (problem: Pick<AutomationProblem, "part" | "index" | "message">): string =>
  problem.part === "conditions" && problem.index !== null ?
    `${PARTS.conditions} (condition ${problem.index + 1}): ${problem.message}` :
    `${PARTS[problem.part]}: ${problem.message}`

/** Why saving, pausing or deleting didn't go, in words. */
export const saveProblem = (error: unknown): string => {
  if (error instanceof InvalidAutomation) return error.problems.map(problemText).join(" ")
  if (error instanceof Conflict) {
    return error.reason === "automationEnded" ?
      "This automation has ended, so it can't change. Set up a new one instead." :
      "This was already saved. Refresh the page to see it."
  }
  if (error instanceof NotFound) return "This automation or its agent is gone, so nothing was saved."
  return "We couldn't reach bluechip just now. Nothing changed, so try again."
}

/** Phrases that each start a sentence, as one line: "At most once an hour, only while the market is open". */
export const asOneLine = (phrases: ReadonlyArray<string>): string =>
  phrases.map((phrase, index) => index === 0 ? phrase : phrase[0]!.toLowerCase() + phrase.slice(1)).join(", ")

/**
 * When it runs or ran, for its card: "Next run Mon 30 Nov, 10:00" for a schedule, else "Last ran 2 h ago", or that
 * it hasn't yet. Times are the viewer's, in `zone`.
 */
export const runLine = (
  automation: Pick<Automation, "status" | "nextRunAt" | "lastFiredAt">,
  now: Date,
  zone: string
): string => {
  if (automation.status === "active" && automation.nextRunAt !== null) {
    return `Next run ${formatDate(DateTime.toDateUtc(automation.nextRunAt), { timeZone: zone })}`
  }
  if (automation.lastFiredAt === null) return automation.status === "active" ? "Hasn't run yet" : "Never ran"
  return `Last ran ${formatRelative(DateTime.toDateUtc(automation.lastFiredAt), now, { timeZone: zone })}`
}
