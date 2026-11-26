import { createFileRoute } from "@tanstack/react-router"
import { AgentsScreen } from "../../../features/agents/screens/AgentsScreen.tsx"

export const Route = createFileRoute("/_app/agents/")({ component: AgentsScreen })
