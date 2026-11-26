import { createFileRoute } from "@tanstack/react-router"
import { AgentsScreen } from "../../../features/agents/screens/AgentsScreen.tsx"
import { useAwaitingByAgent } from "../../../features/intents/hooks/useAwaitingByAgent.ts"

export const Route = createFileRoute("/_app/agents/")({ component: AgentsPage })

function AgentsPage() {
  return <AgentsScreen awaiting={useAwaitingByAgent()} />
}
