import type { RequestId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { approveIntentAtom, confirmIntentAtom, declineIntentAtom } from "../atoms/intents.ts"
import { intentProblem } from "./intentText.ts"
import { useLatestIntent } from "./useLatestIntent.ts"

export type ApprovalFlow =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "signing" }
  | { readonly status: "declining" }
  | { readonly status: "approved"; readonly intent: Intent }
  | { readonly status: "declined"; readonly intent: Intent }
  | { readonly status: "failed"; readonly message: string }

/**
 * Approving an agent's trade with Face ID (the server prepares it, the passkey signs it, the server sends it) or
 * declining it. Once approved, `intent` follows the live `IntentChanged` events until it fills or fails.
 */
export function useApproveIntent(intent: Intent) {
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
      setFlow({ status: "failed", message: intentProblem(error, intent.leg.side) })
    }
  }

  const decline = async () => {
    setFlow({ status: "declining" })
    try {
      setFlow({ status: "declined", intent: await declineIntent({ params: { id: intent.id } }) })
    } catch (error) {
      setFlow({ status: "failed", message: intentProblem(error, intent.leg.side) })
    }
  }

  return { flow, intent: latest, approve, decline }
}
