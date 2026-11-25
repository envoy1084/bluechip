import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import { AgentId } from "@bluechip/domain/Ids"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { createFileRoute, Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import { useState } from "react"
import { agentState, hasSession } from "../../../agents/agentState.ts"
import { agentAtom, agentUsageAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../shell/AppPage.tsx"
import { AgentAlerts } from "./-components/detail/AgentAlerts.tsx"
import { AgentHeader } from "./-components/detail/AgentHeader.tsx"
import { LimitsSection } from "./-components/detail/LimitsSection.tsx"
import { RemoveConfirm } from "./-components/detail/RemoveConfirm.tsx"
import { UsageCard } from "./-components/detail/UsageCard.tsx"
import { useRemoveAgent } from "./-components/detail/useRemoveAgent.ts"

export const Route = createFileRoute("/_app/agents/$agentId")({ component: AgentPage })

const isAgentId = Schema.is(AgentId)

function NotFound() {
  return (
    <AppPage title="Agent not found">
      <Empty>
        <EmptyTitle>We can't find that agent</EmptyTitle>
        <EmptyDescription>It may belong to another account, or the link is wrong.</EmptyDescription>
        <EmptyContent>
          <Button variant="secondary" nativeButton={false} render={<Link to="/agents" />}>See your agents</Button>
        </EmptyContent>
      </Empty>
    </AppPage>
  )
}

function AgentPage() {
  const { agentId } = Route.useParams()
  return isAgentId(agentId) ? <KnownAgent id={agentId} /> : <NotFound />
}

function KnownAgent({ id }: Readonly<{ id: AgentId }>) {
  const agent = useAtomValue(agentAtom(id))
  const refresh = useAtomRefresh(agentAtom(id))

  if (AsyncResult.isSuccess(agent)) return <AgentContent agent={agent.value} />
  if (Option.getOrUndefined(AsyncResult.error(agent)) instanceof NotFoundError) return <NotFound />

  return (
    <AppPage title="Agent" width="wide">
      {AsyncResult.isInitial(agent) ?
        (
          <div aria-busy className="grid gap-4">
            <SkeletonBlock className="h-[112px] w-full rounded-lg" />
            <SkeletonBlock className="h-64 w-full rounded-lg" />
          </div>
        ) :
        (
          <div className="grid justify-items-center gap-3 py-10 text-center">
            <p className="text-body-sm text-g-600">We couldn't load this agent. Check your connection and try again.</p>
            <Button variant="secondary" onClick={refresh}>Try again</Button>
          </div>
        )}
    </AppPage>
  )
}

// Drafts and removed agents have no session to read usage from. One component reads either atom, so the page keeps
// its state (a removal in progress) as the agent moves between them.
const noUsageAtom = Atom.make(AsyncResult.initial<AgentUsage, unknown>())

function AgentContent({ agent }: Readonly<{ agent: Agent }>) {
  const usageAtom: Atom.Atom<AsyncResult.AsyncResult<AgentUsage, unknown>> = hasSession(agent) ?
    agentUsageAtom(agent.id) :
    noUsageAtom
  const read = useAtomValue(usageAtom)
  const usage = hasSession(agent) ? read : undefined
  const [confirming, setConfirming] = useState(false)
  const [now] = useState(() => new Date())
  const removal = useRemoveAgent(agent)
  const state = agentState(
    agent,
    now,
    usage !== undefined && AsyncResult.isSuccess(usage) ? usage.value : undefined
  )

  const removable = agent.status === "draft" || agent.status === "active"
  const keep = () => {
    setConfirming(false)
    removal.reset()
  }

  return (
    <AppPage
      title={agent.name}
      sub={
        <>
          <Link to="/agents" className="hover:text-ink">Agents</Link> / {agent.name}
        </>
      }
      width="wide"
    >
      <div className="grid gap-4">
        <AgentAlerts agent={agent} />
        <AgentHeader agent={agent} state={state} onRemove={() => setConfirming(true)} />
        {confirming && removable && removal.signing.status !== "sent" ?
          (
            <RemoveConfirm
              agent={agent}
              signing={removal.signing}
              onRemove={() => void removal.remove()}
              onKeep={keep}
            />
          ) :
          null}
        <div
          className={usage === undefined ?
            "grid" :
            "grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}
        >
          <LimitsSection agent={agent} />
          {usage === undefined ? null : <UsageCard agent={agent} usage={usage} />}
        </div>
      </div>
    </AppPage>
  )
}
