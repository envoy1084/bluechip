import { Conflict, SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import { isDue, type Recovering } from "@bluechip/domain/recovery/Recovery"
import type { OutcomeTone } from "@bluechip/ui/bluechip/outcome"
import { formatDate } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { unavailableProblem } from "../../../lib/unavailableProblem.ts"

/** Where the recovery page is, from what the server says: what to show and what it offers. */
export interface RecoverStep {
  /** `ask`: no recovery under way, so offer to ask; `make`: due, offer to make it; `wait`: nothing to do yet. */
  readonly offer: "ask" | "make" | "wait" | "signIn"
  readonly tone: OutcomeTone
  readonly title: string
  readonly description: string
}

/** The recovery page's step for the recovery as it stands at `now`. */
export const recoverStep = (recovering: Recovering, now: DateTime.Utc, timeZone: string): RecoverStep => {
  const request = recovering.request
  switch (request?.status) {
    case "requesting":
      return {
        offer: "wait",
        tone: "pending",
        title: "Asking for the recovery",
        description: "Base takes it in a few seconds."
      }
    case "executing":
      return {
        offer: "wait",
        tone: "pending",
        title: "Recovering your account",
        description: "Base takes it in a few seconds."
      }
    case "waiting":
      return isDue(request, now) ?
        {
          offer: "make",
          tone: "neutral",
          title: "Your recovery is ready",
          description: "Touch your recovery key once more and this device's new passkey owns your account."
        } :
        {
          offer: "wait",
          tone: "neutral",
          title: "Your recovery is waiting",
          description:
            `It can go through from ${
              formatDate(DateTime.toDateUtc(request.executableAt!), { timeZone })
            }. Come back then and use your recovery key again. Your account's owner is told on every channel and can ` +
            "cancel it until then."
        }
    case "completed":
      return {
        offer: "signIn",
        tone: "success",
        title: "Your account is yours again",
        description: "This device's new passkey owns your account and the old passkeys were removed."
      }
    default:
      return {
        offer: "ask",
        tone: "neutral",
        title: request?.status === "cancelled" ? "The last recovery was cancelled" : "Ask for a recovery",
        description: "Make a new passkey on this device, then touch your recovery key. Your passkeys are replaced " +
          "48 hours later, unless the account's owner cancels."
      }
  }
}

/** Why a recovery step didn't start, in words. */
export const recoverProblem = (error: unknown): string => {
  if (error instanceof SignatureRejected) {
    return error.reason === "unknownPasskey" ?
      "That isn't a recovery key for a bluechip account. Use the passkey you set up as your recovery key." :
      "The passkey's answer didn't check out. Try again."
  }
  if (error instanceof Conflict) {
    return error.reason === "recoveryNotDue" ?
      "It isn't time yet. Come back once the 48 hours have passed." :
      error.reason === "recoveryPending" ?
      "A recovery is already under way." :
      "This recovery can't go on. Sign in with your recovery key again."
  }
  if (error instanceof Unavailable) return unavailableProblem(error)
  return "The passkey prompt was cancelled or the request couldn't be sent. Nothing changed."
}
