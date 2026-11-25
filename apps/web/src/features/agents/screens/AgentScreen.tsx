import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentType, useState } from "react"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { agentAtom, agentUsageAtom } from "../atoms/agents.ts"
import { AgentAlerts } from "../components/detail/AgentAlerts.tsx"
import { AgentHeader } from "../components/detail/AgentHeader.tsx"
import { PoliciesSection } from "../components/detail/PoliciesSection.tsx"
import { RemoveConfirm } from "../components/detail/RemoveConfirm.tsx"
import { SessionHistory } from "../components/detail/SessionHistory.tsx"
import { UsageCard } from "../components/detail/UsageCard.tsx"
import { useRemoveAgent } from "../hooks/useRemoveAgent.ts"
import { agentState, hasSession } from "../model/agentState.ts"

import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { AgentNotFound } from "../components/detail/AgentNotFound.tsx"

/** A section of the page another feature draws, for an agent, with stock names. */
type Section = ComponentType<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>

interface Sections {
  readonly Trade: Section
  readonly Activity: Section
  /** Opens a conversation with the assistant about the agent. */
  readonly Ask: ComponentType<{ agent: Agent }>
}

/**
 * An agent's page: its alerts, header, policies, usage and sessions. The trade and activity sections come from the
 * intents feature and the way to ask about it from the assistant feature, so the route passes them in.
 */
export function AgentScreen({ id, Trade, Activity, Ask }: Readonly<{ id: AgentId } & Sections>) {
  const agent = useAtomValue(agentAtom(id))
  const refresh = useAtomRefresh(agentAtom(id))

  if (AsyncResult.isSuccess(agent)) {
    return <AgentContent agent={agent.value} Trade={Trade} Activity={Activity} Ask={Ask} />
  }
  if (Option.getOrUndefined(AsyncResult.error(agent)) instanceof NotFoundError) return <AgentNotFound />

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

function AgentContent({ agent, Trade, Activity, Ask }: Readonly<{ agent: Agent } & Sections>) {
  const usageAtom: Atom.Atom<AsyncResult.AsyncResult<AgentUsage, unknown>> = hasSession(agent) ?
    agentUsageAtom(agent.id) :
    noUsageAtom
  const read = useAtomValue(usageAtom)
  const usage = hasSession(agent) ? read : undefined
  const [confirming, setConfirming] = useState(false)
  const [now] = useState(() => new Date())
  const removal = useRemoveAgent(agent)
  const { nameOf } = useStockLookup()
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
      actions={agent.status === "removed" ? undefined : <Ask agent={agent} />}
      width="wide"
    >
      <div className="grid gap-4">
        <AgentAlerts agent={agent} now={now} />
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
          className={agent.status === "draft" ?
            "grid" :
            "grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}
        >
          <div className="grid content-start gap-4">
            <PoliciesSection agent={agent} nameOf={nameOf} />
            {agent.status === "draft" ? null : <Activity agent={agent} nameOf={nameOf} />}
          </div>
          <div className="grid content-start gap-4">
            {state === "active" || state === "stopped" ? <Trade agent={agent} nameOf={nameOf} /> : null}
            {usage === undefined ? null : <UsageCard agent={agent} usage={usage} />}
            {agent.status === "draft" ? null : <SessionHistory agent={agent} nameOf={nameOf} />}
          </div>
        </div>
      </div>
    </AppPage>
  )
}
