import { createFileRoute } from "@tanstack/react-router"
import { AutomationsScreen } from "../../../features/automations/screens/AutomationsScreen.tsx"
import { pageHead } from "../../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/automations/")({
  head: () => pageHead({ title: "Automations", image: "automations" }),
  component: AutomationsScreen
})
