import { createFileRoute } from "@tanstack/react-router"
import { AgentJournalScreen } from "../../../features/agents/screens/AgentTabScreens.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/journal")({ component: AgentJournalScreen })
