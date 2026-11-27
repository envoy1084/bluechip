import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { EditAgentNotFound } from "../../../features/agents/components/edit/EditAgentNotFound.tsx"
import { EditAgentScreen } from "../../../features/agents/screens/EditAgentScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/agents/$agentId_/edit")({
  head: () => pageHead({ title: "Edit rules", image: "agents" }),
  component: EditAgentPage
})

const isAgentId = Schema.is(AgentId)

function EditAgentPage() {
  const { agentId } = Route.useParams()
  return isAgentId(agentId) ? <EditAgentScreen agentId={agentId} /> : <EditAgentNotFound />
}
