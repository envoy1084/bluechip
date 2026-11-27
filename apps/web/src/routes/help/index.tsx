import { createFileRoute } from "@tanstack/react-router"
import { HELP_DESCRIPTION } from "../../features/help/model/articles.ts"
import { HELP_GROUPS } from "../../features/help/model/content.ts"
import { helpIndexStructuredData } from "../../features/help/model/structuredData.ts"
import { HelpIndexScreen } from "../../features/help/screens/HelpIndexScreen.tsx"
import { site } from "../../lib/seo/currentSite.ts"
import { jsonLdScript, pageHead } from "../../lib/seo/head.ts"

export const Route = createFileRoute("/help/")({
  head: () => ({
    ...pageHead({
      title: "Help center",
      description: HELP_DESCRIPTION,
      path: "/help",
      image: "default",
      markdown: true
    }),
    scripts: [jsonLdScript(helpIndexStructuredData(site, HELP_GROUPS))]
  }),
  component: HelpIndexScreen
})
