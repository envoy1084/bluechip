import { createFileRoute } from "@tanstack/react-router"
import { SecurityScreen } from "../../features/security/screens/SecurityScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/_app/settings_/security")({
  head: () => pageHead({ title: "Security", image: "safety" }),
  component: SecurityScreen
})
