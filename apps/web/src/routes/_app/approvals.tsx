import { createFileRoute } from "@tanstack/react-router"
import { ApprovalsScreen } from "../../features/intents/screens/ApprovalsScreen.tsx"

export const Route = createFileRoute("/_app/approvals")({ component: ApprovalsScreen })
