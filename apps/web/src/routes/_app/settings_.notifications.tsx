import { createFileRoute } from "@tanstack/react-router"
import { NotificationSettingsScreen } from "../../features/notifications/screens/NotificationSettingsScreen.tsx"

export const Route = createFileRoute("/_app/settings_/notifications")({ component: NotificationSettingsScreen })
