import type { Agent } from "@bluechip/domain/agents/Agent"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import type { AgentId, RequestId } from "@bluechip/domain/Ids"
import type { Stock } from "@bluechip/domain/market/Market"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@bluechip/ui/components/select"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { stocksAtom } from "../../../atoms/market.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { changedKeys, createAutomationAtom } from "../atoms/automations.ts"
import { AutomationEditor } from "../components/editor/AutomationEditor.tsx"
import { ScreenState } from "../components/ScreenState.tsx"
import { newDraft } from "../model/drafts.ts"
import { specOf, stocksOf, takesAutomations, traderName } from "../model/traders.ts"

const YOU = "you"

/** A new automation: for `agentId` (from its page), or for whoever you pick (from the list), then the editor. */
export function NewAutomationScreen({ agentId }: Readonly<{ agentId?: AgentId | undefined }>) {
  const agents = useAtomValue(agentsAtom)
  const stocks = useAtomValue(stocksAtom)
  const refreshAgents = useAtomRefresh(agentsAtom)
  const refreshStocks = useAtomRefresh(stocksAtom)

  if (AsyncResult.isSuccess(agents) && AsyncResult.isSuccess(stocks)) {
    const traders = agents.value.filter(takesAutomations)
    const start = traders.find((agent) => agent.id === agentId) ?? null
    return <NewAutomation traders={traders} start={start} stocks={stocks.value} />
  }
  return (
    <ScreenState
      title="New automation"
      what="your agents and stocks"
      failed={AsyncResult.isFailure(agents) || AsyncResult.isFailure(stocks)}
      onRetry={() => {
        refreshAgents()
        refreshStocks()
      }}
    />
  )
}

function NewAutomation(
  { traders, start, stocks }: Readonly<{
    traders: ReadonlyArray<Agent>
    start: Agent | null
    stocks: ReadonlyArray<Stock>
  }>
) {
  const create = useAtomSet(createAutomationAtom, { mode: "promise" })
  const navigate = useNavigate()
  const { nameOf } = useStockLookup()
  const [trader, setTrader] = useState<Agent | null>(start)
  const [requestId] = useState(() => crypto.randomUUID() as RequestId)

  const spec = trader === null ? null : specOf(trader)
  const choices = stocksOf(spec, stocks)
  const items = [
    { value: YOU, label: traderName(null) },
    ...traders.map((agent) => ({ value: agent.id, label: agent.name }))
  ]

  return (
    <AppPage
      title="New automation"
      sub={
        <>
          <Link to="/automations" className="hover:text-ink">Automations</Link> / New
        </>
      }
      width="wide"
    >
      <AutomationEditor
        // A different trader starts the automation again, on its stocks and rules.
        key={trader?.id ?? YOU}
        initial={newDraft(trader?.id ?? null, choices[0]!.symbol, DEFAULT_SETTINGS)}
        context={{ stocks: choices, nameOf, zone: localTimeZone() }}
        spec={spec}
        whoTrades={
          <Select
            items={items}
            value={trader?.id ?? YOU}
            onValueChange={(value) => setTrader(traders.find((agent) => agent.id === value) ?? null)}
          >
            <SelectTrigger size="sm" aria-label="Trades through" className="max-w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        saveLabel="Save automation"
        footer={<ButtonLink variant="ghost" className="w-full" render={<Link to="/automations" />}>Cancel</ButtonLink>}
        onSave={async (draft) => {
          const saved = await create({ payload: { requestId, draft }, reactivityKeys: changedKeys })
          await navigate({ to: "/automations/$automationId", params: { automationId: saved.id } })
        }}
      />
    </AppPage>
  )
}
