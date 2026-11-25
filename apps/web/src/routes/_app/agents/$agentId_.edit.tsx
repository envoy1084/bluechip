import { createFileRoute } from "@tanstack/react-router"
import { AppPage } from "../../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/agents/$agentId_/edit")({ component: EditAgentPage })

function EditAgentPage() {
  return <AppPage title="Edit limits">{null}</AppPage>
}
