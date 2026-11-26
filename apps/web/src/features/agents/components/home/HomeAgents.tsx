import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AgentId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatChange } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../../atoms/agents.ts"
import { PageSection } from "../../../../components/layout/PageSection.tsx"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { agentPerformanceAtom } from "../../atoms/performance.ts"
import { useListedAgents } from "../../hooks/useListedAgents.ts"
import { glanceOf } from "../../model/agentGlance.ts"
import { featuredAgents, type ListedAgent } from "../../model/agentList.ts"
import { agentDot } from "../../model/agentState.ts"
import { weekContribution } from "../../model/results.ts"
import { AgentStatePill } from "../AgentStatePill.tsx"
import { GlanceLine } from "../list/AgentListCard.tsx"

const SHOWN = 4

function NewAgentLink() {
  return (
    <ButtonLink variant="ghost" size="sm" render={<Link to="/agents/new" />}>
      <Icon name="plus" size={14} />New agent
    </ButtonLink>
  )
}

/** What it made or lost this week, from its results; nothing for an agent that never locked. */
function WeekLine({ agent, now }: Readonly<{ agent: Agent; now: Date }>) {
  const performance = useAtomValue(agentPerformanceAtom(agent.id))

  if (AsyncResult.isInitial(performance)) return <SkeletonBlock className="h-3 w-24" />
  if (!AsyncResult.isSuccess(performance)) return <span className="text-label-sm text-g-500">Results unavailable</span>

  const week = weekContribution(performance.value.series, now)
  if (week === null) return <span className="text-label-sm text-g-500">No trades yet</span>
  if (week === BigInt(0)) return <span className="text-label-sm text-g-500">Flat this week</span>
  return (
    <span className={cn("text-label-sm font-medium tabular-nums", week > BigInt(0) ? "text-gain" : "text-loss")}>
      {formatChange(usdcDollars(week))} this week
    </span>
  )
}

function AgentTile({ listed, now }: Readonly<{ listed: ListedAgent; now: Date }>) {
  const { agent, state } = listed

  return (
    <li>
      <Link
        to="/agents/$agentId"
        params={{ agentId: agent.id }}
        className="grid h-full gap-3 rounded-lg bg-white p-4 shadow-e2 transition-shadow duration-fast ease-brand hover:shadow-e3 focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
      >
        <span className="flex items-center gap-3">
          <AgentAvatar agentId={agent.id} size="md" status={agentDot(state)} />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{agent.name}</b>
            {state === "unlocked" ?
              <span className="text-label-sm text-g-500">A draft</span> :
              <WeekLine agent={agent} now={now} />}
          </span>
          <AgentStatePill state={state} />
        </span>
        <GlanceLine glance={glanceOf(listed)} />
      </Link>
    </li>
  )
}

function AgentTiles(
  { agents, awaiting }: Readonly<{ agents: ReadonlyArray<Agent>; awaiting: ReadonlyMap<AgentId, number> }>
) {
  const [now] = useState(() => new Date())
  const listed = useListedAgents(agents, awaiting, now)
  const kept = listed.filter((each) => each.state !== "removed").length

  return (
    <PageSection
      title="Your agents"
      actions={
        <>
          {kept > SHOWN ?
            <ButtonLink variant="ghost" size="sm" render={<Link to="/agents" />}>See all {kept}</ButtonLink> :
            null}
          <NewAgentLink />
        </>
      }
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {featuredAgents(listed, SHOWN).map((each) => <AgentTile key={each.agent.id} listed={each} now={now} />)}
      </ul>
    </PageSection>
  )
}

/**
 * Your agents at a glance for home: up to four, those waiting for you first, each with its state, what it made this
 * week and today's budget, with the way to the rest and to a new one. Nothing before your first agent (home's
 * checklist leads there). `awaiting` is how many of each agent's trades wait for you, from the route.
 */
export function HomeAgents({ awaiting }: Readonly<{ awaiting: ReadonlyMap<AgentId, number> }>) {
  const agents = useAtomValue(agentsAtom)
  const refresh = useAtomRefresh(agentsAtom)

  if (AsyncResult.isInitial(agents)) {
    return (
      <div aria-busy className="grid gap-3 sm:grid-cols-2">
        <SkeletonBlock className="h-[104px] w-full rounded-lg" />
        <SkeletonBlock className="h-[104px] w-full rounded-lg max-sm:hidden" />
      </div>
    )
  }
  if (!AsyncResult.isSuccess(agents)) {
    return (
      <PageSection title="Your agents">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3.5 shadow-e2">
          <p className="text-body-sm text-g-600">We couldn't load your agents. Check your connection and try again.</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
        </div>
      </PageSection>
    )
  }
  if (agents.value.every((agent) => agent.status === "removed")) return null

  return <AgentTiles agents={agents.value} awaiting={awaiting} />
}
