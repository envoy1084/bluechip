import { createFileRoute } from "@tanstack/react-router"
import { AutomationsScreen } from "../../../features/automations/screens/AutomationsScreen.tsx"

export const Route = createFileRoute("/_app/automations/")({ component: AutomationsScreen })
