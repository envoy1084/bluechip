import { createFileRoute } from "@tanstack/react-router"
import { AppPage } from "../../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/agents/$agentId")({ component: AgentPage })

function AgentPage() {
  return <AppPage title="Agent">{null}</AppPage>
}
