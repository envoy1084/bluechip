import { createFileRoute } from "@tanstack/react-router"
import { SettingsScreen } from "../../features/settings/screens/SettingsScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/settings")({
  head: () => pageHead({ title: "Settings" }),
  component: SettingsScreen
})
