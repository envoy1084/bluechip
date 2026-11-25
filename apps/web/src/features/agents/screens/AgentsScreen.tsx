import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { AgentListCard } from "../components/list/AgentListCard.tsx"

const PLACEHOLDER_CARDS = ["a", "b", "c"]

function NewAgentButton() {
  return (
    <Button size="sm" nativeButton={false} render={<Link to="/agents/new" />}>
      <Icon name="plus" size={14} />New agent
    </Button>
  )
}

function AgentCards() {
  const agents = useAtomValue(agentsAtom)
  const refresh = useAtomRefresh(agentsAtom)

  if (AsyncResult.isInitial(agents)) {
    return (
      <div aria-busy className="grid gap-3.5 sm:grid-cols-2">
        {PLACEHOLDER_CARDS.map((id) => <SkeletonBlock key={id} className="h-[148px] w-full rounded-lg" />)}
      </div>
    )
  }
  if (!AsyncResult.isSuccess(agents)) {
    return (
      <div className="grid justify-items-center gap-3 py-10 text-center">
        <p className="text-body-sm text-g-600">We couldn't load your agents. Check your connection and try again.</p>
        <Button variant="secondary" onClick={refresh}>Try again</Button>
      </div>
    )
  }
  if (agents.value.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Icon name="agents" size={24} />
        </EmptyMedia>
        <EmptyTitle>No agents yet</EmptyTitle>
        <EmptyDescription>
          Start one from a template. You set its limits and lock them with Face ID before it can trade.
        </EmptyDescription>
        <EmptyContent>
          <NewAgentButton />
        </EmptyContent>
      </Empty>
    )
  }
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {agents.value.map((agent) => <AgentListCard key={agent.id} agent={agent} />)}
    </div>
  )
}

/** The user's agents as cards, with the way to a new one. */
export function AgentsScreen() {
  return (
    <AppPage title="Agents" actions={<NewAgentButton />} width="wide">
      <AgentCards />
    </AppPage>
  )
}
