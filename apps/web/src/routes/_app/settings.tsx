import { createFileRoute } from "@tanstack/react-router"
import { SettingsScreen } from "../../features/settings/screens/SettingsScreen.tsx"

export const Route = createFileRoute("/_app/settings")({ component: SettingsScreen })
