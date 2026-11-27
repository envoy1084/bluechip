import { AgentsShowcase } from "../components/AgentsShowcase.tsx"
import { Assistant } from "../components/Assistant.tsx"
import { Automations } from "../components/Automations.tsx"
import { Faq } from "../components/Faq.tsx"
import { FinalCta } from "../components/FinalCta.tsx"
import { Hero } from "../components/Hero.tsx"
import { HowItWorks } from "../components/HowItWorks.tsx"
import { LandingFooter } from "../components/LandingFooter.tsx"
import { LandingNav } from "../components/LandingNav.tsx"
import { Limits } from "../components/Limits.tsx"
import type { GlanceView, SpecEditorView } from "../components/LimitsDemo.tsx"
import { Safety } from "../components/Safety.tsx"
import { TickerBand } from "../components/TickerBand.tsx"

/**
 * The public page at `/`: what bluechip is, how agents and their onchain limits work, why it's safe, and the ways in
 * (Create an account, Sign in on its own page). Shown to everyone: someone signed in gets Open bluechip in the nav.
 * The limits demo uses the agents feature's own form and glance, passed in by the route.
 */
export function LandingScreen(
  { Editor, Glance }: Readonly<{ Editor: SpecEditorView; Glance: GlanceView }>
) {
  return (
    <div data-page="landing" className="min-h-dvh bg-white text-ink">
      <LandingNav />
      <main>
        <Hero />
        <TickerBand />
        <HowItWorks />
        <Limits Editor={Editor} Glance={Glance} />
        <AgentsShowcase />
        <Automations />
        <Safety />
        <Assistant />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
