import { createFileRoute } from "@tanstack/react-router"
import { ApprovalsScreen } from "../../features/intents/screens/ApprovalsScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/approvals")({
  head: () => pageHead({ title: "Approvals" }),
  component: ApprovalsScreen
})
