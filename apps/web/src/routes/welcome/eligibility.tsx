import { createFileRoute } from "@tanstack/react-router"
import { EligibilityScreen } from "../../features/auth/screens/EligibilityScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/welcome/eligibility")({
  head: () => pageHead({ title: "Where you live" }),
  ssr: false,
  component: EligibilityScreen
})
