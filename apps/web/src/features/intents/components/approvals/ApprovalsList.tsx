import type { Intent } from "@bluechip/domain/intents/Intent"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { agentsAtom } from "../../../../atoms/agents.ts"
import { useStockLookup } from "../../../../hooks/useStockLookup.ts"
import { approvalsAtom } from "../../atoms/intents.ts"
import { ApprovalRequest } from "./ApprovalRequest.tsx"

// "Expires in 14 min" stays right while the list is open.
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

/**
 * Every agent's trade waiting for your Face ID, newest first. One you approve or decline here stays until you press
 * Done, so you can watch it land even after it leaves the server's list.
 */
export function ApprovalsList() {
  const approvals = useAtomValue(approvalsAtom)
  const refresh = useAtomRefresh(approvalsAtom)
  const agents = useAtomValue(agentsAtom)
  const { nameOf, stockOf } = useStockLookup()
  const now = useMinuteClock()
  const [handled, setHandled] = useState<ReadonlyArray<Intent>>([])

  if (AsyncResult.isInitial(approvals)) {
    return (
      <div aria-busy className="grid gap-3">
        <SkeletonBlock className="h-[150px] w-full rounded-lg" />
      </div>
    )
  }
  if (!AsyncResult.isSuccess(approvals)) {
    return (
      <div className="grid justify-items-center gap-3 py-8 text-center">
        <p className="text-body-sm text-g-600">We couldn't load your approvals. Check your connection and try again.</p>
        <Button variant="secondary" onClick={refresh}>
          <Icon name="refresh" size={14} />Try again
        </Button>
      </div>
    )
  }

  const waiting = approvals.value
  const shown = [...waiting, ...handled.filter((intent) => !waiting.some((open) => open.id === intent.id))]
    .sort((a, b) => b.id.localeCompare(a.id))
  const agentName = (intent: Intent) =>
    (AsyncResult.isSuccess(agents) ? agents.value.find((agent) => agent.id === intent.agentId)?.name : undefined) ??
      "Your agent"

  if (shown.length === 0) {
    return (
      <Empty variant="outline" size="sm">
        <EmptyMedia>
          <Icon name="bell" size={18} />
        </EmptyMedia>
        <EmptyTitle>Nothing waiting for you</EmptyTitle>
        <EmptyDescription>When an agent's trade needs your OK, it shows up here.</EmptyDescription>
      </Empty>
    )
  }

  return (
    <ul className="grid gap-3">
      {shown.map((intent) => (
        <li key={intent.id}>
          <ApprovalRequest
            intent={intent}
            agentName={agentName(intent)}
            now={now}
            stockOf={stockOf}
            nameOf={nameOf}
            onHandled={() =>
              setHandled((kept) => kept.some((done) => done.id === intent.id) ? kept : [...kept, intent])}
            onDone={() => setHandled((kept) => kept.filter((done) => done.id !== intent.id))}
          />
        </li>
      ))}
    </ul>
  )
}
