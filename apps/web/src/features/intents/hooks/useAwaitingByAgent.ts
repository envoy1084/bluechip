import type { AgentId } from "@bluechip/domain/Ids"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { approvalsAtom } from "../atoms/intents.ts"

/** How many of each agent's trades wait for your approval; empty until they load. */
export function useAwaitingByAgent(): ReadonlyMap<AgentId, number> {
  const approvals = useAtomValue(approvalsAtom)

  return useMemo(() => {
    const counts = new Map<AgentId, number>()
    if (!AsyncResult.isSuccess(approvals)) return counts
    for (const intent of approvals.value) {
      if (intent.agentId !== null) counts.set(intent.agentId, (counts.get(intent.agentId) ?? 0) + 1)
    }
    return counts
  }, [approvals])
}
