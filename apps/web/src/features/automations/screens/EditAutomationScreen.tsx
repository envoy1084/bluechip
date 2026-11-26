import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Automation } from "@bluechip/domain/automations/Automation"
import { NotFound as NotFoundError } from "@bluechip/domain/Errors"
import type { AutomationId } from "@bluechip/domain/Ids"
import type { Stock } from "@bluechip/domain/market/Market"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { ButtonLink } from "@bluechip/ui/components/button"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { automationAtom, changedKeys, updateAutomationAtom } from "../atoms/automations.ts"
import { AutomationEditor } from "../components/editor/AutomationEditor.tsx"
import { AutomationNotFound, ScreenState } from "../components/ScreenState.tsx"
import { specOf, stocksOf, traderName } from "../model/traders.ts"

/** Changing an automation: loads it, its agent and the stocks, then the editor. Its agent can't change. */
export function EditAutomationScreen({ id }: Readonly<{ id: AutomationId }>) {
  const detail = useAtomValue(automationAtom(id))
  const agents = useAtomValue(agentsAtom)
  const stocks = useAtomValue(stocksAtom)
  const refresh = useAtomRefresh(automationAtom(id))
  const refreshAgents = useAtomRefresh(agentsAtom)
  const refreshStocks = useAtomRefresh(stocksAtom)

  if (AsyncResult.isSuccess(detail) && AsyncResult.isSuccess(agents) && AsyncResult.isSuccess(stocks)) {
    const { automation } = detail.value
    const agent = agents.value.find((candidate) => candidate.id === automation.agentId) ?? null
    return <EditAutomation automation={automation} agent={agent} stocks={stocks.value} />
  }
  if (Option.getOrUndefined(AsyncResult.error(detail)) instanceof NotFoundError) return <AutomationNotFound />

  return (
    <ScreenState
      title="Edit automation"
      what="this automation"
      failed={AsyncResult.isFailure(detail) || AsyncResult.isFailure(agents) || AsyncResult.isFailure(stocks)}
      onRetry={() => {
        refresh()
        refreshAgents()
        refreshStocks()
      }}
    />
  )
}

function EditAutomation(
  { automation, agent, stocks }: Readonly<{ automation: Automation; agent: Agent | null; stocks: ReadonlyArray<Stock> }>
) {
  const update = useAtomSet(updateAutomationAtom, { mode: "promise" })
  const navigate = useNavigate()
  const { nameOf } = useStockLookup()
  const ended = automation.status === "done" || automation.status === "expired"
  const spec = agent === null ? null : specOf(agent)
  const back = <Link to="/automations/$automationId" params={{ automationId: automation.id }} />

  return (
    <AppPage
      title={`Edit ${automation.name}`}
      sub={
        <>
          <Link to="/automations" className="hover:text-ink">Automations</Link> /{" "}
          <Link to="/automations/$automationId" params={{ automationId: automation.id }} className="hover:text-ink">
            {automation.name}
          </Link>
        </>
      }
      width="wide"
    >
      {ended ?
        (
          <Alert variant="info">
            <AlertDescription>
              This automation has ended, so it can't change. Set up a new one instead.
            </AlertDescription>
          </Alert>
        ) :
        (
          <AutomationEditor
            initial={automation}
            context={{ stocks: stocksOf(spec, stocks), nameOf, zone: localTimeZone() }}
            spec={spec}
            whoTrades={automation.agentId === null || agent !== null ? traderName(agent) : "An agent that's gone"}
            saveLabel="Save changes"
            footer={<ButtonLink variant="ghost" className="w-full" render={back}>Cancel</ButtonLink>}
            onSave={async (draft) => {
              await update({ params: { id: automation.id }, payload: { draft }, reactivityKeys: changedKeys })
              await navigate({ to: "/automations/$automationId", params: { automationId: automation.id } })
            }}
          />
        )}
    </AppPage>
  )
}
