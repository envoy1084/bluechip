import { createFileRoute } from "@tanstack/react-router"
import { TermsScreen } from "../../features/legal/screens/TermsScreen.tsx"

export const Route = createFileRoute("/legal/terms")({ component: TermsScreen })
