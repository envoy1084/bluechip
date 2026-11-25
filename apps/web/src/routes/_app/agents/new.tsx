import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { NewAgentScreen } from "../../../features/agents/screens/NewAgentScreen.tsx"

const isAgentId = Schema.is(AgentId)

export const Route = createFileRoute("/_app/agents/new")({
  // `draft`: a draft the assistant made, opened at its rules to customize.
  validateSearch: (search: Record<string, unknown>): { draft?: AgentId } =>
    isAgentId(search["draft"]) ? { draft: search["draft"] } : {},
  component: NewAgentPage
})

function NewAgentPage() {
  const { draft } = Route.useSearch()
  return <NewAgentScreen draftId={draft} />
}
