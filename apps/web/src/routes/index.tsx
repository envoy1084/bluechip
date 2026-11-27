import { createFileRoute } from "@tanstack/react-router"
import { AgentAtAGlance } from "../features/agents/components/spec/AgentAtAGlance.tsx"
import { SpecForm } from "../features/agents/components/spec/SpecForm.tsx"
import { LandingScreen } from "../features/landing/screens/LandingScreen.tsx"

export const Route = createFileRoute("/")({ component: Landing })

function Landing() {
  return <LandingScreen Editor={SpecForm} Glance={AgentAtAGlance} />
}
