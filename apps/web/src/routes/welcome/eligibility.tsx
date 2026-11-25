import { createFileRoute } from "@tanstack/react-router"
import { EligibilityScreen } from "../../features/auth/screens/EligibilityScreen.tsx"

export const Route = createFileRoute("/welcome/eligibility")({ ssr: false, component: EligibilityScreen })
