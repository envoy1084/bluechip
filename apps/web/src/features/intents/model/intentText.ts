// How an intent reads on screen: its status as a pill, the time it waits until, why a request didn't go, and how many
// wait for you.
import { Conflict } from "@bluechip/domain/Errors"
import type { Decision, Intent, IntentStatus } from "@bluechip/domain/intents/Intent"
import { formatRelative, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { localTimeZone } from "../../../lib/localTime.ts"
import { tradeProblem } from "../../../lib/tradeProblem.ts"

export const STATUS: Readonly<Record<IntentStatus, { readonly label: string; readonly tone: string }>> = {
  proposed: { label: "Asked", tone: "bg-g-100 text-g-600" },
  deciding: { label: "Checking", tone: "bg-blue-50 text-blue" },
  waiting: { label: "Waiting", tone: "bg-warn-wash text-warn" },
  needsApproval: { label: "Needs your approval", tone: "bg-blue-50 text-blue" },
  awaitingSignature: { label: "Waiting for Face ID", tone: "bg-blue-50 text-blue" },
  sending: { label: "Sending", tone: "bg-blue-50 text-blue" },
  confirming: { label: "Confirming", tone: "bg-blue-50 text-blue" },
  filled: { label: "Filled", tone: "bg-gain-wash text-gain" },
  failed: { label: "Didn't go through", tone: "bg-loss-wash text-loss" },
  blocked: { label: "Blocked", tone: "bg-loss-wash text-loss" },
  declined: { label: "Declined", tone: "bg-g-100 text-g-600" },
  expired: { label: "Ran out", tone: "bg-g-100 text-g-600" },
  cancelled: { label: "Cancelled", tone: "bg-g-100 text-g-600" }
}

/**
 * The decision an intent's line shows: a wait only while it still waits, since an intent cancelled, expired or decided
 * again afterwards keeps its last decision, and "It tries again at 05:34" would no longer be true.
 */
export const shownDecision = (intent: Intent): Decision | null =>
  intent.decision?._tag === "Wait" && intent.status !== "waiting" ? null : intent.decision

/** When it was asked, for its row: "2 min ago", "Yesterday", then the date. */
export const askedAt = (intent: Intent, now: Date): string =>
  formatRelative(DateTime.toDateUtc(intent.createdAt), now, { timeZone: localTimeZone() })

/** The viewer's own clock time of a moment: "14:30". */
export const clockTime = (at: DateTime.Utc): string => formatTime(DateTime.toDateUtc(at), { timeZone: localTimeZone() })

/** How long until a request runs out: "Expires in 14 min", "Expires in 3 h", or that it has. */
export const expiresIn = (at: DateTime.Utc, now: Date): string => {
  const minutes = Math.ceil((DateTime.toEpochMillis(at) - now.getTime()) / 60_000)
  if (minutes <= 0) return "Expired"
  if (minutes < 60) return `Expires in ${minutes} min`
  return `Expires in ${Math.round(minutes / 60)} h`
}

/** Why asking for, approving or cancelling a trade didn't go, in words. */
export const intentProblem = (error: unknown, side: "buy" | "sell"): string => {
  if (error instanceof Conflict) {
    if (error.reason === "agentBusy") {
      return "This agent can't trade right now: it's paused, its rules ran out, or it isn't locked or is changing."
    }
    if (error.reason === "intentClosed") return "This trade has already moved on, so there's nothing to do."
    if (error.reason === "intentChanged") {
      return "This trade changed while you answered (declined, expired or sent elsewhere), so nothing more was done."
    }
  }
  return tradeProblem(error, side)
}

/** "2 trades waiting for you", or that nothing is. */
export const waitingText = (count: number) =>
  count === 0 ? "Nothing waiting for you" : count === 1 ? "1 trade waiting for you" : `${count} trades waiting for you`

/** Who asked for it, as its row says it. */
export const SOURCE: Readonly<Record<Intent["source"], string>> = {
  owner: "You",
  assistant: "Assistant",
  automation: "Automation",
  channel: "Telegram",
  mcp: "An app"
}
