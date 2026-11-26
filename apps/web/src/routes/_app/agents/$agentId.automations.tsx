import { createFileRoute } from "@tanstack/react-router"
import { useAgentPage } from "../../../features/agents/components/detail/AgentPageContext.ts"
import { AgentAutomations } from "../../../features/automations/components/AgentAutomations.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/automations")({ component: AutomationsTab })

function AutomationsTab() {
  const { agent } = useAgentPage()
  return <AgentAutomations agent={agent} />
}
