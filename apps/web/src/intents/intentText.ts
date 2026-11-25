// How an intent reads on screen: its status as a pill, the time it waits until, and why a request didn't go.
import { Conflict, Unavailable } from "@bluechip/domain/Errors"
import type { Intent, IntentStatus } from "@bluechip/domain/intents/Intent"
import { formatRelative, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { localTimeZone } from "../activity/ActivityLine.tsx"
import { tradeProblem } from "../market/useTrade.ts"

export const STATUS: Readonly<Record<IntentStatus, { readonly label: string; readonly tone: string }>> = {
  proposed: { label: "Asked", tone: "bg-g-100 text-g-600" },
  deciding: { label: "Checking", tone: "bg-blue-50 text-blue" },
  waiting: { label: "Waiting", tone: "bg-warn-wash text-warn" },
  needsApproval: { label: "Needs your OK", tone: "bg-blue-50 text-blue" },
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

/** "Nothing was bought. Your cash is where it was.", for a trade that ended without moving money. */
export const nothingMoved = (side: "buy" | "sell"): string =>
  side === "buy"
    ? "Nothing was bought. Your cash is where it was."
    : "Nothing was sold. Your stocks are where they were."

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
    if (error.reason === "agentBusy") return "This agent can't trade right now: it's paused, not locked or changing."
    if (error.reason === "intentClosed") return "This trade has already moved on, so there's nothing to do."
  }
  if (error instanceof Unavailable) return "We couldn't reach Base just now. Nothing changed, so try again in a moment."
  return tradeProblem(error, side)
}
