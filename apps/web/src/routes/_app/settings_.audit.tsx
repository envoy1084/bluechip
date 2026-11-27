import { createFileRoute } from "@tanstack/react-router"
import { AuditScreen } from "../../features/audit/screens/AuditScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/settings_/audit")({
  head: () => pageHead({ title: "Audit log" }),
  component: AuditScreen
})
