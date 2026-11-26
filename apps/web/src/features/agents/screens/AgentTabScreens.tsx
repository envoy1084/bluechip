import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type { ComponentType, ReactNode } from "react"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { SectionHeader } from "../../../components/layout/SectionHeader.tsx"
import { useAgentState } from "../../../hooks/useAgentState.ts"
import { useNow } from "../../../hooks/useNow.ts"
import { limitLine } from "../../../lib/agentState.ts"
import { useAgentPage } from "../components/detail/AgentPageContext.ts"
import { JournalSection } from "../components/detail/journal/JournalSection.tsx"
import { PoliciesSection } from "../components/detail/PoliciesSection.tsx"
import { AgentResults } from "../components/detail/results/AgentResults.tsx"
import { SessionHistory } from "../components/detail/SessionHistory.tsx"
import { UsageCard } from "../components/detail/UsageCard.tsx"

/** A section another feature draws for the agent, with stock names. */
type Section = ComponentType<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>

/**
 * Its rules, and beside them trading with it while it can trade (the trade box comes from the intents feature). Done
 * for today, it says until when instead; a rebalancer trades only back to its mix, so it offers a rebalance, which the
 * assistant proposes.
 */
export function AgentOverviewScreen({ Trade }: Readonly<{ Trade: Section }>) {
  const { agent, nameOf, usage } = useAgentPage()
  const state = useAgentState(agent)
  const now = useNow(60_000)
  const read = usage !== undefined && AsyncResult.isSuccess(usage) ? usage.value : undefined
  const rebalances = configOf(agent.spec.policies, trade)?.direction === "rebalance"
  const side = state === "active" || state === "needs-approval" ?
    (rebalances ? <RebalanceNow agent={agent} /> : <Trade agent={agent} nameOf={nameOf} />) :
    state === "stopped" ?
    <DoneForToday agent={agent} limit={read === undefined ? null : limitLine(read, now)} /> :
    null

  return (
    <div
      className={side === null ?
        "grid gap-4" :
        "grid items-start gap-4 min-[860px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}
    >
      <PoliciesSection agent={agent} nameOf={nameOf} />
      {side}
    </div>
  )
}

function TradeSide({ agent, children }: Readonly<{ agent: Agent; children: ReactNode }>) {
  return (
    <section aria-labelledby={`trade-${agent.id}`} className="grid content-start gap-3">
      <SectionHeader
        id={`trade-${agent.id}`}
        level="h3"
        title="Trade with this agent"
        description="Its rules decide before anything is sent."
      />
      <div className="grid gap-3 rounded-lg bg-white p-[18px] shadow-e2">{children}</div>
    </section>
  )
}

function RebalanceNow({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <TradeSide agent={agent}>
      <p className="text-[13.5px] text-g-700">
        {agent.name}{" "}
        trades only back to your target mix. Ask for a rebalance and the assistant shows you the trades first.
      </p>
      <ButtonLink
        size="sm"
        className="justify-self-start"
        render={
          <Link
            to="/chat/{-$conversationId}"
            params={{ conversationId: undefined }}
            search={{ agent: agent.id, ask: `Rebalance ${agent.name} back to its target mix now.` }}
          />
        }
      >
        <Icon name="scales" size={14} />Rebalance now
      </ButtonLink>
    </TradeSide>
  )
}

function DoneForToday({ agent, limit }: Readonly<{ agent: Agent; limit: string | null }>) {
  return (
    <TradeSide agent={agent}>
      <p className="text-[13.5px] text-g-700">
        {agent.name} is done for today, so it can't take a trade now. {limit ?? ""}
      </p>
    </TradeSide>
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
