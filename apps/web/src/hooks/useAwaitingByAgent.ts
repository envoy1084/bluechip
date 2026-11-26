import type { AgentId } from "@bluechip/domain/Ids"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { approvalsAtom } from "../atoms/approvals.ts"

/**
 * How many of each agent's trades wait for your approval: `undefined` while they load, empty if they couldn't (an
 * agent's state then goes without them rather than waiting forever).
 */
export function useAwaitingByAgent(): ReadonlyMap<AgentId, number> | undefined {
  const approvals = useAtomValue(approvalsAtom)

  return useMemo(() => {
    if (AsyncResult.isInitial(approvals)) return undefined

    const counts = new Map<AgentId, number>()
    if (!AsyncResult.isSuccess(approvals)) return counts
    for (const intent of approvals.value) {
      if (intent.agentId !== null) counts.set(intent.agentId, (counts.get(intent.agentId) ?? 0) + 1)
    }
    return counts
  }, [approvals])
}
