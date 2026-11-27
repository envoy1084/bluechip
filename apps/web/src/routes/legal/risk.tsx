import { createFileRoute } from "@tanstack/react-router"
import { RISK } from "../../features/legal/model/documents.ts"
import { RiskScreen } from "../../features/legal/screens/RiskScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/legal/risk")({
  head: () => pageHead({ title: RISK.title, description: RISK.description, path: RISK.path, image: "legal" }),
  component: RiskScreen
})
