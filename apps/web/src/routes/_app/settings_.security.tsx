import { createFileRoute } from "@tanstack/react-router"
import { SecurityScreen } from "../../features/security/screens/SecurityScreen.tsx"

export const Route = createFileRoute("/_app/settings_/security")({ component: SecurityScreen })
