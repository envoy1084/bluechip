import { createFileRoute } from "@tanstack/react-router"
import { AgentHistoryScreen } from "../../../features/agents/screens/AgentTabScreens.tsx"
import { AgentActivity } from "../../../features/intents/components/agent/AgentActivity.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/history")({
  component: () => <AgentHistoryScreen Activity={AgentActivity} />
})
