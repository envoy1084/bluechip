import { createFileRoute } from "@tanstack/react-router"
import { AgentResultsScreen } from "../../../features/agents/screens/AgentTabScreens.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/results")({ component: AgentResultsScreen })
