import { createFileRoute } from "@tanstack/react-router"
import { RiskScreen } from "../../features/legal/screens/RiskScreen.tsx"

export const Route = createFileRoute("/legal/risk")({ component: RiskScreen })
