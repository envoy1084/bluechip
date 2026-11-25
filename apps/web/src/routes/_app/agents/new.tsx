import { createFileRoute } from "@tanstack/react-router"
import { AppPage } from "../../../shell/AppPage.tsx"

export const Route = createFileRoute("/_app/agents/new")({ component: NewAgentPage })

function NewAgentPage() {
  return <AppPage title="New agent">{null}</AppPage>
}
