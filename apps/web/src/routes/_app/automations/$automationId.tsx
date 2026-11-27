import { AutomationId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { AgentStateNow } from "../../../components/AgentStatePill.tsx"
import { AutomationNotFound } from "../../../features/automations/components/ScreenState.tsx"
import { AutomationScreen } from "../../../features/automations/screens/AutomationScreen.tsx"
import { IntentLine } from "../../../features/intents/components/IntentLine.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/automations/$automationId")({
  head: () => pageHead({ title: "Automation", image: "automations" }),
  component: AutomationPage
})

const isAutomationId = Schema.is(AutomationId)

function AutomationPage() {
  const { automationId } = Route.useParams()
  return isAutomationId(automationId)
    ? <AutomationScreen id={automationId} Intent={IntentLine} AgentState={AgentStateNow} />
    : <AutomationNotFound />
}
