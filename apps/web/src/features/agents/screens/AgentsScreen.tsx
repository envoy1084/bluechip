import type { Agent } from "@bluechip/domain/agents/Agent"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { IllustratedEmpty } from "../../../components/IllustratedEmpty.tsx"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { agentMomentAtom } from "../atoms/moment.ts"
import { AgentListCard } from "../components/list/AgentListCard.tsx"
import { AgentListToolbar } from "../components/list/AgentListToolbar.tsx"
import { useListedAgents } from "../hooks/useListedAgents.ts"
import { type AgentFilter, type AgentSort, filterCounts, matches, shows, sortAgents } from "../model/agentList.ts"
import { momentText } from "../model/agentMoment.ts"

const PLACEHOLDER_CARDS = ["a", "b", "c"]

function NewAgentButton({ size = "sm" }: Readonly<{ size?: "sm" | "md" }>) {
  return (
    <ButtonLink size={size} render={<Link to="/agents/new" />}>
      <Icon name="plus" size={14} />New agent
    </ButtonLink>
  )
}

function AgentCards() {
  const agents = useAtomValue(agentsAtom)
  const refresh = useAtomRefresh(agentsAtom)

  if (AsyncResult.isInitial(agents)) {
    return (
      <div aria-busy className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {PLACEHOLDER_CARDS.map((id) => <SkeletonBlock key={id} className="h-[104px] w-full rounded-lg" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(agents)) {
    return <LoadProblem what="your agents" onRetry={refresh} />
  }
  if (agents.value.length === 0) {
    return (
      <IllustratedEmpty
        illustration="butterfly"
        size={160}
        title="No agents yet"
        action={
          <>
            <NewAgentButton size="md" />
            <ButtonLink
              variant="secondary"
              render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
            >
              <Icon name="chat" size={16} />Ask the assistant
            </ButtonLink>
          </>
        }
      >
        Start one from a template. You set its limits, and it trades only once they're locked.
      </IllustratedEmpty>
    )
  }
  return <AgentList agents={agents.value} />
}

/** Your agents, filtered, searched and sorted; the toolbar shows once there are two to choose between. */
function AgentList({ agents }: Readonly<{ agents: ReadonlyArray<Agent> }>) {
  const [now] = useState(() => new Date())
  const [filter, setFilter] = useState<AgentFilter>("all")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<AgentSort>("recent")
  const { nameOf } = useStockLookup()

  const listed = useListedAgents(agents, now)

  const shown = sortAgents(
    listed.filter((each) => shows(each, filter) && matches(each.agent, query, nameOf)),
    sort
  )
  const clear = () => {
    setFilter("all")
    setQuery("")
  }

  return (
    <div className="grid gap-4">
      {agents.length > 1 ?
        (
          <AgentListToolbar
            counts={filterCounts(listed)}
            filter={filter}
            query={query}
            sort={sort}
            onFilter={setFilter}
            onQuery={setQuery}
            onSort={setSort}
          />
        ) :
        null}
      {shown.length === 0 ?
        (
          <IllustratedEmpty
            illustration="magnifier"
            size={120}
            title="No agents match"
            action={<Button variant="secondary" onClick={clear}>Show all agents</Button>}
          >
            {query.trim() === "" ?
              "None of your agents are in this state right now." :
              `No agent's name or stocks match "${query.trim()}".`}
          </IllustratedEmpty>
        ) :
        (
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((each) => <AgentListCard key={each.agent.id} listed={each} />)}
          </div>
        )}
    </div>
  )
}

/** The agent just removed on its page, said once here until dismissed. */
function RemovedAlert() {
  const [handed, setHanded] = useAtom(agentMomentAtom)
  const [removed, setRemoved] = useState(() => handed?.moment === "removed" ? handed : null)
  useEffect(() => {
    if (handed?.moment === "removed") setHanded(null)
  }, [handed, setHanded])

  if (removed === null) return null

  const text = momentText("removed", { name: removed.name, lockedUntil: null })
  return (
    <Alert variant="success" className="mb-4 animate-pop-in">
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>{text.description}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" onClick={() => setRemoved(null)}>Done</Button>
      </AlertAction>
    </Alert>
  )
}

/** The user's agents as compact cards, with the way to a new one. */
export function AgentsScreen() {
  return (
    <AppPage title="Agents" actions={<NewAgentButton />} width="wide">
      <RemovedAlert />
      <AgentCards />
    </AppPage>
  )
}
