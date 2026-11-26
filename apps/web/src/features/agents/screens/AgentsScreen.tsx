import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useEffect, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { AppPage } from "../../../components/layout/AppPage.tsx"
import { agentMomentAtom } from "../atoms/moment.ts"
import { AgentListCard } from "../components/list/AgentListCard.tsx"
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
        <Illustration name="butterfly" variant="halftone" size={160} animate className="-my-2" />
        <EmptyTitle>No agents yet</EmptyTitle>
        <EmptyDescription>
          Start one from a template. You set its limits, and it trades only once they're locked.
        </EmptyDescription>
        <EmptyContent className="flex flex-wrap justify-center gap-2">
          <NewAgentButton size="md" />
          <ButtonLink
            variant="secondary"
            render={<Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} />}
          >
            <Icon name="chat" size={16} />Ask the assistant
          </ButtonLink>
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

/** The user's agents as cards, with the way to a new one. */
export function AgentsScreen() {
  return (
    <AppPage title="Agents" actions={<NewAgentButton />} width="wide">
      <RemovedAlert />
      <AgentCards />
    </AppPage>
  )
}
