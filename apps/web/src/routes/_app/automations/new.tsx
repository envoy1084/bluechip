import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { NewAutomationScreen } from "../../../features/automations/screens/NewAutomationScreen.tsx"

const isAgentId = Schema.is(AgentId)

export const Route = createFileRoute("/_app/automations/new")({
  // `agent`: the agent it trades through, from its page.
  validateSearch: (search: Record<string, unknown>): { agent?: AgentId } =>
    isAgentId(search["agent"]) ? { agent: search["agent"] } : {},
  component: NewAutomationPage
})

function NewAutomationPage() {
  const { agent } = Route.useSearch()
  return <NewAutomationScreen agentId={agent} />
}
