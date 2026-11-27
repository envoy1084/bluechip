import { createFileRoute } from "@tanstack/react-router"
import { PRIVACY } from "../../features/legal/model/documents.ts"
import { PrivacyScreen } from "../../features/legal/screens/PrivacyScreen.tsx"
import { pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/legal/privacy")({
  head: () =>
    pageHead({
      title: PRIVACY.title,
      description: PRIVACY.description,
      path: PRIVACY.path,
      image: "legal",
      markdown: true
    }),
  component: PrivacyScreen
})
