import { createFileRoute } from "@tanstack/react-router"
import { PrivacyScreen } from "../../features/legal/screens/PrivacyScreen.tsx"

export const Route = createFileRoute("/legal/privacy")({ component: PrivacyScreen })
