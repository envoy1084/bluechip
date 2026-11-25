import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"

/** Opens a new conversation on Home about one agent. */
export function AskAboutAgent({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <Button
      variant="secondary"
      size="sm"
      nativeButton={false}
      render={<Link to="/home" search={{ agent: agent.id }} />}
    >
      <Icon name="chat" size={14} />Ask about this agent
    </Button>
  )
}
