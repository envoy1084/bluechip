// Where a trade stands, in the words every screen and chat card uses: one label and one tone per status.
import type { IntentStatus } from "@bluechip/domain/intents/Intent"
import type { StatusTone } from "@bluechip/ui/bluechip/status-pill"

export interface StatusWords {
  readonly label: string
  readonly tone: StatusTone
}

export const INTENT_STATUS: Readonly<Record<IntentStatus, StatusWords>> = {
  proposed: { label: "Asked", tone: "neutral" },
  deciding: { label: "Checking", tone: "pending" },
  waiting: { label: "Waiting", tone: "attention" },
  needsApproval: { label: "Needs your approval", tone: "pending" },
  awaitingSignature: { label: "Waiting for Face ID", tone: "pending" },
  sending: { label: "Sending", tone: "pending" },
  confirming: { label: "Confirming", tone: "pending" },
  filled: { label: "Filled", tone: "positive" },
  failed: { label: "Didn't go through", tone: "negative" },
  blocked: { label: "Blocked", tone: "negative" },
  declined: { label: "Declined", tone: "neutral" },
  // "Ran out" is an agent whose session ended; a trade nobody decided in time timed out.
  expired: { label: "Timed out", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" }
}
