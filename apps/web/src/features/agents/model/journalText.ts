// How each line of the journal reads: the pill a trade's moment or a run's outcome shows, the note under a trade, what
// set a run off and the illustration it leads with, a judgment's answer, what happened to its rules and who asked, and
// what a filter that finds nothing says.
import type { SessionAuthor } from "@bluechip/domain/agents/Agent"
import type { RunOutcome } from "@bluechip/domain/automations/Run"
import type { JournalKind } from "@bluechip/domain/journal/Journal"
import type { IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { nothingMoved } from "../../../lib/tradeOutcome.ts"
import { dayLabel } from "./fieldText.ts"
import type { TradeMoment } from "./journalStory.ts"
import type { JournalFilter, RulesMoment } from "./journalTimeline.ts"

export const MOMENT_LABEL: Readonly<Record<TradeMoment, string>> = {
  filled: "Filled",
  sent: "Sent",
  blocked: "Blocked",
  needsApproval: "Asked for your approval",
  waiting: "Waiting",
  approved: "Approved",
  failed: "Didn't go through",
  declined: "Declined",
  expired: "Ran out",
  cancelled: "Cancelled"
}

/** What a trade's moment meant, when its pill and decision don't say it already. */
export const momentNote = (moment: TradeMoment, side: "buy" | "sell"): string | null => {
  switch (moment) {
    case "filled":
    case "needsApproval":
    case "waiting":
      return null
    case "sent":
      return "Within its policies, so it sent it itself."
    case "approved":
      return "You approved it, and it waited for your Face ID."
    case "blocked":
    case "failed":
    case "declined":
    case "expired":
    case "cancelled":
      return nothingMoved(side)
  }
}

export const RUN_LABEL: Readonly<Record<RunOutcome, string>> = {
  proposed: "Proposed trades",
  asked: "Asked you first",
  notified: "Let you know",
  skipped: "Skipped",
  failed: "Failed"
}

const TRIGGER_ILLUSTRATION: Readonly<Record<string, IllustrationName>> = {
  schedule: "calendar",
  priceMove: "price-move",
  priceCross: "price-level",
  drift: "target",
  portfolio: "pie",
  news: "newspaper"
}

/** What a run leads with: its trigger's illustration, or a bolt when its automation isn't known. */
export const runIllustration = (trigger: string | undefined): IllustrationName =>
  (trigger === undefined ? undefined : TRIGGER_ILLUSTRATION[trigger]) ?? "bolt"

/** What sets an automation off, after its name: "Runs every Monday at 10:00 New York time". */
export const runsWhen = (trigger: string): string => `Runs ${trigger}`

/** What a note leads with, by the kind of entry it was written for. */
export const NOTE_ILLUSTRATION: Readonly<Record<JournalKind, IllustrationName>> = {
  intent: "coins",
  automation: "bolt",
  judgment: "scales"
}

/** A model's answer in a judgment: "Yes, 82% sure". */
export const judgmentAnswer = (verdict: boolean, confidence: number): string =>
  `${verdict ? "Yes" : "No"}, ${Math.round(confidence * 100)}% sure`

export const RULES_TITLE: Readonly<Record<RulesMoment["change"], string>> = {
  locked: "Rules locked with Face ID",
  changed: "Rules changed",
  renewed: "Rules renewed",
  ranOut: "Its rules ran out"
}

export const RULES_ILLUSTRATION: Readonly<Record<RulesMoment["change"], IllustrationName>> = {
  locked: "lock",
  changed: "fence",
  renewed: "key",
  ranOut: "hourglass"
}

/** What a rules moment changed, in a sentence. */
export const rulesDetail = (moment: Pick<RulesMoment, "change" | "moved" | "until">): string => {
  const until = moment.until === null ? "" : `, until ${dayLabel(moment.until)}`
  switch (moment.change) {
    case "locked":
      return `Its first rules${until}.`
    case "changed":
      return `${moment.moved.join(", ")}${until}.`
    case "renewed":
      return `The same rules with a new key${until}.`
    case "ranOut":
      return "It can't trade until you renew them."
  }
}

/** Who asked for a set of rules; you always sign them. */
export const RULES_AUTHOR: Readonly<Record<SessionAuthor, string>> = {
  owner: "You",
  assistant: "Assistant, signed by you",
  automation: "Automation, signed by you"
}

/** What a filter says when the entries loaded so far have none of its kind. */
export const EMPTY_FILTER: Readonly<Record<Exclude<JournalFilter, "all">, string>> = {
  trades: "No trades in these entries.",
  automations: "No automation runs in these entries.",
  rules: "Its rules didn't change in these entries."
}
