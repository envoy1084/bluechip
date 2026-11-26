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
      <Icon name="chat" size={14} />Ask about this agent
    </ButtonLink>
  )
}
