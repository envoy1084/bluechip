import type { Agent } from "@bluechip/domain/agents/Agent"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"

/** Opens a new chat about one agent, its trades going through it. */
export function AskAboutAgent({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <ButtonLink
      variant="secondary"
      size="sm"
      render={
        <Link to="/chat/{-$conversationId}" params={{ conversationId: undefined }} search={{ agent: agent.id }} />
      }
    >
      <Icon name="chat" size={14} />
      {/* Its icon alone on a phone, where the top bar has room for the agent's name and little else. */}
      <span className="max-sm:sr-only">Ask about this agent</span>
    </ButtonLink>
  )
}
