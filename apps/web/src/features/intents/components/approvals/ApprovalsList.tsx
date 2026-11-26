import type { Intent } from "@bluechip/domain/intents/Intent"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../../atoms/agents.ts"
import { approvalsAtom } from "../../../../atoms/approvals.ts"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { LoadProblem } from "../../../../components/LoadProblem.tsx"
import { useNow } from "../../../../hooks/useNow.ts"
import { type ApprovalGroup, approvalGroups } from "../../model/approvalGroups.ts"
import { ApprovalRequest } from "./ApprovalRequest.tsx"

/**
 * Every agent's trade waiting for your Face ID, newest first. One you approve or decline here stays until you press
 * Done, so you can watch it land even after it leaves the server's list.
 */
export function ApprovalsList() {
  const approvals = useAtomValue(approvalsAtom)
  const refresh = useAtomRefresh(approvalsAtom)
  const agents = useAtomValue(agentsAtom)
  // "Expires in 14 min" stays right while the list is open.
  const now = useNow(30_000)
  const [handled, setHandled] = useState<ReadonlyArray<ApprovalGroup>>([])

  if (AsyncResult.isInitial(approvals)) {
    return (
      <div aria-busy className="grid gap-3">
        <SkeletonBlock className="h-[150px] w-full rounded-lg" />
      </div>
    )
  }
  if (!AsyncResult.isSuccess(approvals)) {
    return <LoadProblem what="your approvals" onRetry={refresh} size="sm" />
  }

  // A card you approved or declined stays as it was: the trades that went with it don't lead cards of their own.
  const waiting = approvals.value
  const kept = new Set(handled.flatMap((group) => [group.intent.id, ...group.together.map((intent) => intent.id)]))
  const shown = [
    ...approvalGroups(waiting.filter((intent) => !kept.has(intent.id))),
    ...handled
  ].sort((a, b) => b.intent.id.localeCompare(a.intent.id))
  const agentName = (intent: Intent) =>
    (AsyncResult.isSuccess(agents) ? agents.value.find((agent) => agent.id === intent.agentId)?.name : undefined) ??
      "Your agent"

  if (shown.length === 0) {
    return (
      <IllustratedEmpty illustration="passkey" size={120} variant="outline" compact title="All clear">
        When an agent's trade needs your approval, it shows up here.
      </IllustratedEmpty>
    )
  }

  return (
    <ul className="grid gap-3">
      {shown.map((group) => (
        <li key={group.intent.id}>
          <ApprovalRequest
            intent={group.intent}
            together={group.together}
            agentName={agentName(group.intent)}
            now={now}
            onHandled={() =>
              setHandled((kept) => kept.some((done) => done.intent.id === group.intent.id) ? kept : [...kept, group])}
            onDone={() => setHandled((kept) => kept.filter((done) => done.intent.id !== group.intent.id))}
          />
        </li>
      ))}
    </ul>
  )
}
