// How automations read on screen: what a model answered, and each of the editor's choices in words.
import type { Action, AutomationProblem, Trigger } from "@bluechip/domain/automations/Automation"
import type { JudgmentAnswer, JudgmentPreset } from "@bluechip/domain/automations/conditions/Judgment"
import type { Weekday } from "@bluechip/domain/automations/Time"
import { Conflict, InvalidAutomation, NotFound } from "@bluechip/domain/Errors"

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
      return value === "above" ? "Rises above" : "Falls below"
    case "portfolio.direction":
      return value === "below" ? "Falls under" : "Rises over"
    case "portfolio.measure":
      return value === "cash" ? "Cash" : "A holding"
    case "judgment.preset":
      return PRESETS[value as JudgmentPreset] ?? value
    default:
      return value
  }
}

/** Each trigger as you might set it up, on its card, about no stock in particular: "Every Monday at 10:00". */
export const TRIGGER_EXAMPLES: Readonly<Record<Trigger["type"], string>> = {
  schedule: "Every Monday at 10:00",
  priceMove: "A stock falls 10% from its high",
  priceCross: "A stock goes above a price you set",
  drift: "Your mix drifts from its target",
  portfolio: "Cash falls under 10% of your portfolio",
  news: "A story about a stock or topic you pick"
}

/** Each action as you might set it up, on its card, about no stock in particular. */
export const ACTION_EXAMPLES: Readonly<Record<Action["type"], string>> = {
  buy: "Buy a dollar amount of stocks you pick",
  sell: "Sell a dollar amount of a stock",
  sellShare: "Sell a quarter, half or all of a holding",
  rebalance: "Trade back to the target mix",
  notify: "Send you a message",
  ask: "Propose a trade for your Face ID"
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
