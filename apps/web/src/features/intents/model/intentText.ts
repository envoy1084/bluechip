// How an intent reads on screen (its status in `lib/intentStatus.ts`): the time it waits until, why a request didn't go, and how many
// wait for you.
import { Conflict } from "@bluechip/domain/Errors"
import type { Decision, Intent } from "@bluechip/domain/intents/Intent"
import { formatRelative, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { localTimeZone } from "../../../lib/localTime.ts"
import { tradeProblem } from "../../../lib/tradeProblem.ts"

/**
 * The decision an intent's line shows: a wait only while it still waits, since an intent cancelled, expired or decided
 * again afterwards keeps its last decision, and "It tries again at 05:34" would no longer be true.
 */
export const shownDecision = (intent: Intent): Decision | null =>
  intent.decision?._tag === "Wait" && intent.status !== "waiting" ? null : intent.decision

const ASKED_BY: Readonly<Record<Intent["source"], string>> = {
  owner: "You",
  assistant: "The assistant",
  automation: "Your automation",
  channel: "Your chat",
  mcp: "An app you connected"
}

/** Who asks for a trade: its agent's name, or, for a trade of your own, where it came from. */
export const askedBy = (intent: Pick<Intent, "source">, agentName: string | undefined): string =>
  agentName ?? ASKED_BY[intent.source]

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

/** "2 trades wait for your approval", or that nothing does: said this way wherever approvals are counted. */
export const waitingText = (count: number) =>
  count === 0 ?
    "Nothing waits for your approval" :
    count === 1 ?
    "1 trade waits for your approval" :
    `${count} trades wait for your approval`
