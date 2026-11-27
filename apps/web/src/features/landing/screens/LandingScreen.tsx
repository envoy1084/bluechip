import { SignedInRedirect } from "../../../components/SignedInRedirect.tsx"
import { AgentsShowcase } from "../components/AgentsShowcase.tsx"
import { Assistant } from "../components/Assistant.tsx"
import { Faq } from "../components/Faq.tsx"
import { FinalCta } from "../components/FinalCta.tsx"
import { Hero } from "../components/Hero.tsx"
import { HowItWorks } from "../components/HowItWorks.tsx"
import { LandingFooter } from "../components/LandingFooter.tsx"
import { LandingNav } from "../components/LandingNav.tsx"
import { Permissions } from "../components/Permissions.tsx"
import { Safety } from "../components/Safety.tsx"
import { TickerBand } from "../components/TickerBand.tsx"

/**
 * The public page at `/`: what bluechip is, how agents and their onchain limits work, why it's safe, and the ways in
 * (Create an account, Sign in on its own page). Someone already signed in goes on to home.
 */
export function LandingScreen() {
  return (
    <div data-page="landing" className="min-h-dvh bg-white text-ink">
      <SignedInRedirect />
      <LandingNav />
      <main>
        <Hero />
        <TickerBand />
        <HowItWorks />
        <Permissions />
        <AgentsShowcase />
        <Safety />
        <Assistant />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
