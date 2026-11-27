import { createFileRoute } from "@tanstack/react-router"
import { TERMS } from "../../features/legal/model/documents.ts"
import { TermsScreen } from "../../features/legal/screens/TermsScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/legal/terms")({
  head: () => pageHead({ title: TERMS.title, description: TERMS.description, path: TERMS.path, image: "legal" }),
  component: TermsScreen
})
