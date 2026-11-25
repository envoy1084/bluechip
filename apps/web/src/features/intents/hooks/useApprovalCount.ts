import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { approvalsAtom } from "../atoms/intents.ts"

/** The approvals waiting for you: a count for badges, 0 until they load. */
export function useApprovalCount(): number {
  const approvals = useAtomValue(approvalsAtom)
  return AsyncResult.isSuccess(approvals) ? approvals.value.length : 0
}
