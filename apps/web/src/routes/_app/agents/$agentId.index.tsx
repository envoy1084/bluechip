import { createFileRoute } from "@tanstack/react-router"
import { AgentOverviewScreen } from "../../../features/agents/screens/AgentTabScreens.tsx"
import { TradeWithAgent } from "../../../features/intents/components/agent/TradeWithAgent.tsx"

export const Route = createFileRoute("/_app/agents/$agentId/")({
  component: () => <AgentOverviewScreen Trade={TradeWithAgent} />
})
