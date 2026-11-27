import { createFileRoute } from "@tanstack/react-router"
import { AgentsScreen } from "../../../features/agents/screens/AgentsScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/agents/")({
  head: () => pageHead({ title: "Agents", image: "agents" }),
  component: AgentsScreen
})
