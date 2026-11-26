import type { Intent } from "@bluechip/domain/intents/Intent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { approvalsAtom } from "../../../atoms/approvals.ts"
import { approvalGroups } from "../model/approvalGroups.ts"

const NONE: ReadonlyArray<Intent> = []

/** The other trades of its plan one Face ID sends with `intent` (empty when it goes alone, or isn't waiting). */
export function useApprovalGroup(intent: Intent): ReadonlyArray<Intent> {
  const approvals = useAtomValue(approvalsAtom)
  if (!AsyncResult.isSuccess(approvals)) return NONE
  return approvalGroups(approvals.value).find((group) => group.intent.id === intent.id)?.together ?? NONE
}
