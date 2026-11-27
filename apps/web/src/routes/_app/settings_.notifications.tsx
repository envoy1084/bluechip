import { createFileRoute } from "@tanstack/react-router"
import { NotificationSettingsScreen } from "../../features/notifications/screens/NotificationSettingsScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/settings_/notifications")({
  head: () => pageHead({ title: "Notifications" }),
  component: NotificationSettingsScreen
})
