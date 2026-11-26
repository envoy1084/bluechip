import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type ComponentType, useState } from "react"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { agentState } from "../../../lib/agentState.ts"
import { useAgentPage } from "../components/detail/AgentPageContext.ts"
import { JournalSection } from "../components/detail/journal/JournalSection.tsx"
import { PoliciesSection } from "../components/detail/PoliciesSection.tsx"
import { AgentResults } from "../components/detail/results/AgentResults.tsx"
import { SessionHistory } from "../components/detail/SessionHistory.tsx"
import { UsageCard } from "../components/detail/UsageCard.tsx"

/** A section another feature draws for the agent, with stock names. */
type Section = ComponentType<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>

/** Its rules, and trading with it while it can trade (the trade box comes from the intents feature). */
export function AgentOverviewScreen({ Trade }: Readonly<{ Trade: Section }>) {
  const { agent, nameOf, usage } = useAgentPage()
  const [now] = useState(() => new Date())
  const state = agentState(agent, now, usage !== undefined && AsyncResult.isSuccess(usage) ? usage.value : undefined)
  const trades = state === "active" || state === "stopped"

  return (
    <div
      className={trades ?
        "grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" :
        "grid gap-4"}
    >
      <PoliciesSection agent={agent} nameOf={nameOf} />
      {trades ? <Trade agent={agent} nameOf={nameOf} /> : null}
    </div>
  )
}

/** What it did and why, as it happened. */
export function AgentJournalScreen() {
  const { agent } = useAgentPage()
  return <JournalSection agent={agent} />
}

/** What it contributed: profit, what it bought and sold, its costs and what its policies held back. */
export function AgentResultsScreen() {
  const { agent } = useAgentPage()
  return <AgentResults agent={agent} />
}

/** How much of each limit it has used today. */
export function AgentUsageScreen() {
  const { agent, usage } = useAgentPage()
  if (usage !== undefined) return <UsageCard agent={agent} usage={usage} />

  const ended = agent.status === "expired" || agent.status === "removed"
  return (
    <IllustratedEmpty illustration="hourglass" title={ended ? "Nothing to count" : "Nothing counted yet"}>
      {ended ?
        `${agent.name}'s session has ended, so nothing counts against its limits now.` :
        `Once its limits are locked on Base, what ${agent.name} spends and trades each day shows up here.`}
    </IllustratedEmpty>
  )
}

/** Its trades (from the intents feature), then each time its rules were locked. */
export function AgentHistoryScreen({ Activity }: Readonly<{ Activity: Section }>) {
  const { agent, nameOf } = useAgentPage()
  return (
    <div className="grid gap-4">
      <Activity agent={agent} nameOf={nameOf} />
      <SessionHistory agent={agent} nameOf={nameOf} />
    </div>
  )
}
