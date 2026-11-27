import { createFileRoute } from "@tanstack/react-router"
import { AgentAtAGlance } from "../features/agents/components/spec/AgentAtAGlance.tsx"
import { SpecForm } from "../features/agents/components/spec/SpecForm.tsx"
import { QUESTIONS } from "../features/landing/model/questions.ts"
import { landingStructuredData } from "../features/landing/model/structuredData.ts"
import { LandingScreen } from "../features/landing/screens/LandingScreen.tsx"
import { site } from "../lib/seo/currentSite.ts"
import { jsonLdScript, pageHead } from "../lib/seo/head.ts"

export const Route = createFileRoute("/")({
  head: () => {
    const head = pageHead({
      fullTitle: "bluechip: AI agents for tokenized stocks on Base",
      path: "/",
      image: "default",
      markdown: true
    })
    return { ...head, scripts: [jsonLdScript(landingStructuredData(site, QUESTIONS))] }
  },
  component: Landing
})

function Landing() {
  return <LandingScreen Editor={SpecForm} Glance={AgentAtAGlance} />
}
