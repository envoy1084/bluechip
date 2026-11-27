import type { AutomationDetail } from "@bluechip/domain/automations/Run"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AutomationId, IntentId } from "@bluechip/domain/Ids"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ComponentType, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { usePageTitle } from "../../../hooks/usePageTitle.ts"
import { automationAtom } from "../atoms/automations.ts"
import { automationPerformanceAtom } from "../atoms/performance.ts"
import { type AgentStateView, AutomationHero } from "../components/detail/AutomationHero.tsx"
import { ResultsSection } from "../components/detail/ResultsSection.tsx"
import { RunTimeline } from "../components/detail/RunTimeline.tsx"
import { AutomationNotFound, ScreenState } from "../components/ScreenState.tsx"

type IntentView = ComponentType<{ id: IntentId }>

/**
 * One automation: what it does, who trades and where it stands, with Pause, Edit and Delete; what its runs came to
 * (one count of its runs, from the ledger, for the hero and the results); then its runs as a timeline. `Intent` draws each trade a run proposed (from the intents feature) and `AgentState`
 * its agent's state (from the agents feature), both through the route.
 */
export function AutomationScreen(
  { id, Intent, AgentState }: Readonly<{ id: AutomationId; Intent: IntentView; AgentState: AgentStateView }>
) {
  const detail = useAtomValue(automationAtom(id))
  const refresh = useAtomRefresh(automationAtom(id))

  if (AsyncResult.isSuccess(detail)) {
    return <AutomationContent detail={detail.value} Intent={Intent} AgentState={AgentState} />
  }
  if (Option.getOrUndefined(AsyncResult.error(detail)) instanceof NotFoundError) return <AutomationNotFound />
  return (
    <ScreenState title="Automation" what="this automation" failed={AsyncResult.isFailure(detail)} onRetry={refresh} />
  )
}

function AutomationContent(
  { detail, Intent, AgentState }: Readonly<{ detail: AutomationDetail; Intent: IntentView; AgentState: AgentStateView }>
) {
  const { automation } = detail
  const agents = useAtomValue(agentsAtom)
  const result = useAtomValue(automationPerformanceAtom(automation.id))
  const performance = AsyncResult.isSuccess(result) ? result.value : undefined
  const [now] = useState(() => new Date())
  usePageTitle(automation.name)

  const agent = automation.agentId === null ?
    null :
    AsyncResult.isSuccess(agents) ?
    agents.value.find((candidate) => candidate.id === automation.agentId) ?? null :
    undefined

  return (
    <AppPage
      title={automation.name}
      sub={
        <>
          <Link to="/automations" className="hover:text-ink">Automations</Link> / {automation.name}
        </>
      }
      width="wide"
    >
      <AutomationHero detail={detail} performance={performance} agent={agent} now={now} AgentState={AgentState} />
      {performance === undefined || performance.runs === 0 ? null : <ResultsSection performance={performance} />}
      <RunTimeline detail={detail} now={now} Intent={Intent} />
    </AppPage>
  )
}
