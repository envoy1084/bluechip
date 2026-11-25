import { createFileRoute } from "@tanstack/react-router"
import { AppPage } from "../../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/agents/")({ component: AgentsPage })

function AgentsPage() {
  return <AppPage title="Agents">{null}</AppPage>
}
