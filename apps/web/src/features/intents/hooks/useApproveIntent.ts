import type { RequestId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { passkeyProblem } from "../../../lib/passkeyProblem.ts"
import { approveIntentAtom, confirmIntentAtom, declineIntentAtom } from "../atoms/intents.ts"
import { intentProblem } from "../model/intentText.ts"
import { useLatestIntent } from "./useLatestIntent.ts"

type ApprovalFlow =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "signing" }
  | { readonly status: "declining" }
  | { readonly status: "approved"; readonly intent: Intent }
  | { readonly status: "declined"; readonly intent: Intent }
  | { readonly status: "cancelled"; readonly message: string }
  | { readonly status: "failed"; readonly message: string }

/**
 * Approving an agent's trade with Face ID (the server prepares it with the trades of its plan that go `together`, the
 * passkey signs them, the server sends them) or declining them. Once approved, `intent` follows the live
 * `IntentChanged` events until it fills or fails. A Face ID you close is `cancelled`, a quiet note: nothing was sent.
 */
export function useApproveIntent(intent: Intent, together: ReadonlyArray<Intent> = []) {
  const approveIntent = useAtomSet(approveIntentAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmIntentAtom, { mode: "promise" })
  const declineIntent = useAtomSet(declineIntentAtom, { mode: "promise" })
  const [flow, setFlow] = useState<ApprovalFlow>({ status: "idle" })
  const latest = useLatestIntent(flow.status === "approved" || flow.status === "declined" ? flow.intent : intent)

  const approve = async () => {
    setFlow({ status: "preparing" })
    try {
      const request = await approveIntent({
        params: { id: intent.id },
        payload: { requestId: crypto.randomUUID() as RequestId }
      })
      setFlow({ status: "signing" })
      setFlow({ status: "approved", intent: await confirm({ id: request.id, options: request.options }) })
    } catch (error) {
      // Closing Face ID is a choice, not a failure: the approval waits as it was, until its own deadline.
      const passkey = passkeyProblem(error, intent.leg.side === "buy" ? "Nothing was bought." : "Nothing was sold.")
      setFlow(
        passkey.cancelled ?
          { status: "cancelled", message: passkey.text } :
          { status: "failed", message: intentProblem(error, intent.leg.side) }
      )
    }
  }

  const decline = async () => {
    setFlow({ status: "declining" })
    try {
      const declined = await declineIntent({ params: { id: intent.id } })
      for (const other of together) await declineIntent({ params: { id: other.id } })
      setFlow({ status: "declined", intent: declined })
    } catch (error) {
      setFlow({ status: "failed", message: intentProblem(error, intent.leg.side) })
    }
  }

  return { flow, intent: latest, approve, decline }
}
