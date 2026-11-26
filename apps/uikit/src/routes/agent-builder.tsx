import { createFileRoute } from "@tanstack/react-router"
import { KitAgentBuilder } from "../pages/agent-builder/page.tsx"

export const Route = createFileRoute("/agent-builder")({ component: KitAgentBuilder })
