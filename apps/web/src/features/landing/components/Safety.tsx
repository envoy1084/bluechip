import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { Reveal } from "./Reveal.tsx"
import { FairPriceChart, RecoveryTrack } from "./SafetyVisuals.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

interface Guarantee {
  readonly art: IllustrationName
  /** The plate's wash behind the object. */
  readonly wash: string
  readonly title: string
  readonly text: string
  /** What it looks like in the app, at the card's foot. */
  readonly proof: ReactNode
}

const GUARANTEES: ReadonlyArray<Guarantee> = [
  {
    art: "passkey",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-blue-100),var(--color-blue-50)_70%)]",
    title: "Only your Face ID moves money",
    text: "Your passkeys own the account. No password, no seed phrase.",
    proof: <StatusPill tone="info" icon="face-id">Signed with Face ID</StatusPill>
  },
  {
    art: "fence",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-loss-line),var(--color-loss-wash)_70%)]",
    title: "Limits hold onchain",
    text: "A trade past an agent's limits is refused by Base, not by a promise.",
    proof: <StatusPill tone="negative" icon="stop-sign">Blocked by Max in one stock</StatusPill>
  },
  {
    art: "scales",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-info-line),var(--color-info-wash)_70%)]",
    title: "Fair prices, from Chainlink",
    text: "A trade too far from Chainlink's price doesn't happen.",
    proof: <FairPriceChart />
  },
  {
    art: "bell",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-yellow-soft),var(--color-warn-wash)_70%)]",
    title: "You approve the big ones",
    text: "Over an agent's largest trade, it waits for you. Unanswered, it expires.",
    proof: <StatusPill tone="pending" dot="live">Waiting for your Face ID</StatusPill>
  },
  {
    art: "hourglass",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-blue-100),var(--color-g-50)_70%)]",
    title: "Recovery waits 48 hours",
    text: "You're told everywhere, and can cancel from any device or Telegram.",
    proof: <RecoveryTrack />
  },
  {
    art: "emergency-stop",
    wash: "bg-[radial-gradient(circle_at_50%_60%,var(--color-gain-line),var(--color-gain-wash)_70%)]",
    title: "Pause or withdraw anytime",
    text: "One tap stops every agent. Your cash is USDC you can send anywhere.",
    proof: <StatusPill tone="positive" icon="pause">Every agent is paused</StatusPill>
  }
]

/**
 * Why it's safe: six guarantees, each something the app or the chain does today, on even cards. Each card shows its
 * object, the guarantee in a line, and how it looks in the app.
 */
export function Safety() {
  return (
    <section
      id="safety"
      aria-labelledby="landing-safety"
      className="scroll-mt-20 bg-[linear-gradient(180deg,var(--color-g-50),#fff)] px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Safety" title={<span id="landing-safety">Your account answers only to you</span>} />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((guarantee, index) => (
            <Reveal as="li" key={guarantee.title} delay={(index % 3) * 100} className="grid">
              <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-e2">
                <div className={cn("grid h-[132px] place-items-center", guarantee.wash)}>
                  <Illustration name={guarantee.art} size={80} aria-hidden />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="grid gap-1">
                    <h3 className="text-title-3 font-semibold">{guarantee.title}</h3>
                    <p className="text-body-sm text-g-600">{guarantee.text}</p>
                  </div>
                  {/* The same panel for every proof, so each row's cards line up. */}
                  <div className="mt-auto grid h-[120px] place-items-center overflow-hidden rounded-xl bg-g-50 px-4 shadow-[inset_0_0_0_1px_rgba(10,11,13,.04)]">
                    <div className="grid w-full justify-items-center">{guarantee.proof}</div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
