import { type Trigger, TRIGGERS } from "@bluechip/domain/automations/Automation"
import { AgentId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { NewAutomationScreen } from "../../../features/automations/screens/NewAutomationScreen.tsx"

const isAgentId = Schema.is(AgentId)
const isTrigger = (value: unknown): value is Trigger["type"] => TRIGGERS.some((trigger) => trigger.type === value)

export const Route = createFileRoute("/_app/automations/new")({
  // `agent`: the agent it trades through, from its page; `trigger`: what starts it, from an example picked.
  validateSearch: (search: Record<string, unknown>): { agent?: AgentId; trigger?: Trigger["type"] } => ({
    ...(isAgentId(search["agent"]) ? { agent: search["agent"] } : {}),
    ...(isTrigger(search["trigger"]) ? { trigger: search["trigger"] } : {})
  }),
  component: NewAutomationPage
})

function NewAutomationPage() {
  const { agent, trigger } = Route.useSearch()
  return <NewAutomationScreen agentId={agent} trigger={trigger} />
}
