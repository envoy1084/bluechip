import type { Agent, AgentStatus } from "@bluechip/domain/agents/Agent"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Empty, EmptyDescription, EmptyTitle } from "@bluechip/ui/components/empty"
import { Link } from "@tanstack/react-router"

const WHY: Readonly<Record<Exclude<AgentStatus, "active">, { readonly title: string; readonly say: string }>> = {
  draft: {
    title: "It isn't locked yet",
    say: "A draft has no rules in force. Lock it with Face ID first, then you can change them."
  },
  locking: {
    title: "Its rules are being locked",
    say: "They're on their way to Base. You can change them once they land."
  },
  updating: {
    title: "A change is on its way",
    say: "Its last change is landing on Base. You can make another once it's in force."
  },
  removing: {
    title: "It's being removed",
    say: "Its rules can't change while it's being removed."
  },
  expired: {
    title: "Its rules ran out",
    say: "Its session ended, so it can't trade. Renew it with Face ID first, then you can change its rules."
  },
  removed: {
    title: "It was removed",
    say: "A removed agent has no rules to change."
  }
}

/** Why an agent's rules can't be changed right now: only an active agent's can. */
export function NotChangeable(
  { agent, status }: Readonly<{ agent: Agent; status: Exclude<AgentStatus, "active"> }>
) {
  const why = WHY[status]

  return (
    <Empty>
      <EmptyTitle>{why.title}</EmptyTitle>
      <EmptyDescription>{why.say}</EmptyDescription>
      <ButtonLink
        variant="secondary"
        render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
      >
        Back to {agent.name}
      </ButtonLink>
    </Empty>
  )
}
