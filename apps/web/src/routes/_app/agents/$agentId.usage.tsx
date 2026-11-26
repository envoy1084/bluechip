import { createFileRoute } from "@tanstack/react-router"
import { AgentUsageScreen } from "../../../features/agents/screens/AgentTabScreens.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/usage")({ component: AgentUsageScreen })
