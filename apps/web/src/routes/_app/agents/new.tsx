import { createFileRoute } from "@tanstack/react-router"
import { NewAgentScreen } from "../../../features/agents/screens/NewAgentScreen.tsx"

export const Route = createFileRoute("/_app/agents/new")({ component: NewAgentScreen })
