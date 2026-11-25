import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { EditAgentNotFound } from "../../../features/agents/components/edit/EditAgentNotFound.tsx"
import { EditAgentScreen } from "../../../features/agents/screens/EditAgentScreen.tsx"

export const Route = createFileRoute("/_app/agents/$agentId_/edit")({ component: EditAgentPage })

const isAgentId = Schema.is(AgentId)

function EditAgentPage() {
  const { agentId } = Route.useParams()
  return isAgentId(agentId) ? <EditAgentScreen agentId={agentId} /> : <EditAgentNotFound />
}
