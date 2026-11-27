import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute, useLocation } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { NewAgentScreen } from "../../../features/agents/screens/NewAgentScreen.tsx"
import { SavedTemplateAutomations } from "../../../features/automations/components/template/SavedTemplateAutomations.tsx"
import { TemplateAutomations } from "../../../features/automations/components/template/TemplateAutomations.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

const AUTOMATIONS = { Defaults: TemplateAutomations, Saved: SavedTemplateAutomations }

const isAgentId = Schema.is(AgentId)

export const Route = createFileRoute("/_app/agents/new")({
  head: () => pageHead({ title: "New agent", image: "agents" }),
  // `draft`: a draft the assistant made, opened at its rules to customize.
  validateSearch: (search: Record<string, unknown>): { draft?: AgentId } =>
    isAgentId(search["draft"]) ? { draft: search["draft"] } : {},
  component: NewAgentPage
})

function NewAgentPage() {
  const { draft } = Route.useSearch()
  // Each visit is a flow of its own: following "New agent" from its last step starts it afresh.
  const visit = useLocation({ select: (location) => location.state.__TSR_key })
  return <NewAgentScreen key={visit} draftId={draft} automations={AUTOMATIONS} />
}
