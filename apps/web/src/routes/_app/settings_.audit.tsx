import { createFileRoute } from "@tanstack/react-router"
import { AuditScreen } from "../../features/audit/screens/AuditScreen.tsx"

export const Route = createFileRoute("/_app/settings_/audit")({ component: AuditScreen })
