import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AgentId } from "@bluechip/domain/Ids"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { TabsLink, TabsNav } from "@bluechip/ui/components/tabs"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentType, type ReactNode, useState } from "react"
import { agentUsageAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useAgentState } from "../../../hooks/useAgentState.ts"
import { hasSession, limitLine } from "../../../lib/agentState.ts"
import { agentAtom } from "../atoms/agents.ts"
import { AgentAlerts } from "../components/detail/AgentAlerts.tsx"
import { AgentHeader } from "../components/detail/AgentHeader.tsx"
import { RemoveConfirm } from "../components/detail/RemoveConfirm.tsx"
import { useRemoveAgent } from "../hooks/useRemoveAgent.ts"

import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { AgentNotFound } from "../components/detail/AgentNotFound.tsx"
import { AgentPageContext } from "../components/detail/AgentPageContext.ts"

/** The page's tabs: the overview first, then each part of the agent on a page of its own. */
const TABS = [
  { to: "/agents/$agentId", label: "Overview", exact: true },
  { to: "/agents/$agentId/automations", label: "Automations", exact: false },
  { to: "/agents/$agentId/journal", label: "Journal", exact: false },
  { to: "/agents/$agentId/results", label: "Results", exact: false },
  { to: "/agents/$agentId/usage", label: "Usage", exact: false },
  { to: "/agents/$agentId/history", label: "History", exact: false }
] as const

/**
 * An agent's page: its alerts and header, then tabs for its overview (rules and trading), automations, journal,
 * results, usage and history. Each tab is a route of its own, drawn in `children`, reading the agent from
 * {@link AgentPageContext}; the way to ask about it comes from the assistant feature, so the route passes it in.
 */
export function AgentScreen(
  { id, Ask, children }: Readonly<{ id: AgentId; Ask: ComponentType<{ agent: Agent }>; children: ReactNode }>
) {
  const agent = useAtomValue(agentAtom(id))
  const refresh = useAtomRefresh(agentAtom(id))

  if (AsyncResult.isSuccess(agent)) return <AgentContent agent={agent.value} Ask={Ask}>{children}</AgentContent>
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
        <LoadProblem what="this agent" onRetry={refresh} />}
    </AppPage>
  )
}

// Drafts and removed agents have no session to read usage from. One component reads either atom, so the page keeps
// its state (a removal in progress) as the agent moves between them.
const noUsageAtom = Atom.make(AsyncResult.initial<AgentUsage, unknown>())

function AgentContent(
  { agent, Ask, children }: Readonly<{ agent: Agent; Ask: ComponentType<{ agent: Agent }>; children: ReactNode }>
) {
  const usageAtom: Atom.Atom<AsyncResult.AsyncResult<AgentUsage, unknown>> = hasSession(agent) ?
    agentUsageAtom(agent.id) :
    noUsageAtom
  const read = useAtomValue(usageAtom)
  const usage = hasSession(agent) ? read : undefined
  const [confirming, setConfirming] = useState(false)
  const [now] = useState(() => new Date())
  const removal = useRemoveAgent(agent)
  const { nameOf } = useStockLookup()
  const state = useAgentState(agent)

  const removable = agent.status === "draft" || agent.status === "active" || agent.status === "expired"
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
        <AgentHeader
          agent={agent}
          state={state}
          limit={usage !== undefined && AsyncResult.isSuccess(usage) ? limitLine(usage.value, now) : null}
          onRemove={() => setConfirming(true)}
        />
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
        {agent.status === "draft" ?
          null :
          (
            <TabsNav aria-label={`${agent.name}'s pages`}>
              {TABS.map((tab) => (
                <TabsLink
                  key={tab.to}
                  render={<Link to={tab.to} params={{ agentId: agent.id }} activeOptions={{ exact: tab.exact }} />}
                >
                  {tab.label}
                </TabsLink>
              ))}
            </TabsNav>
          )}
        <AgentPageContext value={{ agent, usage, nameOf }}>{children}</AgentPageContext>
      </div>
    </AppPage>
  )
}
