import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { AgentNotFound } from "../../../features/agents/components/detail/AgentNotFound.tsx"
import { AgentScreen } from "../../../features/agents/screens/AgentScreen.tsx"
import { AskAboutAgent } from "../../../features/assistant/components/AskAboutAgent.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/agents/$agentId")({
  head: () => pageHead({ title: "Agent", image: "agents" }),
  component: AgentPage
})

const isAgentId = Schema.is(AgentId)

function AgentPage() {
  const { agentId } = Route.useParams()
  if (!isAgentId(agentId)) return <AgentNotFound />

  return (
    <AgentScreen id={agentId} Ask={AskAboutAgent}>
      <Outlet />
    </AgentScreen>
  )
}
