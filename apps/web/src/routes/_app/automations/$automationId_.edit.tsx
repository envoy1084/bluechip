import { AutomationId } from "@bluechip/domain/Ids"
import { createFileRoute } from "@tanstack/react-router"
import * as Schema from "effect/Schema"
import { AutomationNotFound } from "../../../features/automations/components/ScreenState.tsx"
import { EditAutomationScreen } from "../../../features/automations/screens/EditAutomationScreen.tsx"

export const Route = createFileRoute("/_app/automations/$automationId_/edit")({ component: EditAutomationPage })

const isAutomationId = Schema.is(AutomationId)

function EditAutomationPage() {
  const { automationId } = Route.useParams()
  return isAutomationId(automationId) ? <EditAutomationScreen id={automationId} /> : <AutomationNotFound />
}
