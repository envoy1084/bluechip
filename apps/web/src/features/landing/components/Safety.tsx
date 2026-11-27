import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import { Seal } from "@bluechip/ui/motion/seal"
import type { ReactNode } from "react"
import { Reveal } from "./Reveal.tsx"
import { FairPriceChart, RecoveryTrack } from "./SafetyVisuals.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

/**
 * One claim: its object (pixel art, or a larger visual that grows into the room the row gives it), its title and a
 * line. Cards in a row share its height, so the visual takes what the text leaves.
 */
function SafetyCard(
  { art, title, children, visual, delay, className }: Readonly<{
    art?: IllustrationName
    title: string
    children: ReactNode
    visual?: ReactNode
    delay: number
    className?: string
  }>
) {
  return (
    <Reveal
      as="li"
      delay={delay}
      className={cn("flex flex-col gap-4 overflow-hidden rounded-2xl bg-white p-6 shadow-e2", className)}
    >
      {art === undefined ?
        null :
        (
          <span className="grid size-14 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] shadow-[inset_0_0_0_1px_var(--color-info-line)]">
            <Illustration name={art} size={40} aria-hidden />
          </span>
        )}
      <div className="grid gap-1.5">
        <h3 className="text-title-3 font-semibold">{title}</h3>
        <p className="max-w-[48ch] text-body-sm text-g-600">{children}</p>
      </div>
      {visual === undefined ? null : <div className="mt-auto grid flex-1 content-end pt-2">{visual}</div>}
    </Reveal>
  )
}

/** Why it's safe, each claim one thing the app or the chain does today, in three even rows. */
export function Safety() {
  return (
    <section
      id="safety"
      aria-labelledby="landing-safety"
      className="scroll-mt-20 bg-[linear-gradient(180deg,var(--color-g-50),#fff)] px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Safety" title={<span id="landing-safety">Safe by how it's built</span>} />

        <ul className="grid gap-4 md:grid-flow-dense md:grid-cols-2 lg:grid-cols-3">
          <SafetyCard
            title="Every trade checked against Chainlink"
            delay={0}
            className="md:col-span-2"
            visual={<FairPriceChart />}
          >
            A trade that would fill too far from Chainlink's price doesn't happen.
          </SafetyCard>
          <SafetyCard
            title="Face ID, not passwords"
            delay={100}
            visual={
              <div className="grid h-full min-h-[180px] place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_50%,var(--color-blue-50),transparent_70%)]">
                <Illustration name="passkey" variant="halftone" size={170} animate aria-hidden />
              </div>
            }
          >
            Your passkeys own your account. No seed phrase to lose.
          </SafetyCard>

          <SafetyCard
            title="Recovery waits 48 hours"
            delay={0}
            className="md:col-span-2"
            visual={<RecoveryTrack />}
          >
            A recovery key can only ask. You're told everywhere, and can cancel it from any device or Telegram.
          </SafetyCard>
          <SafetyCard
            title="You approve the big ones"
            delay={100}
            visual={<Seal label="Approved with Face ID" className="size-24" />}
          >
            Over an agent's largest trade, it waits for your Face ID.
          </SafetyCard>

          <SafetyCard art="emergency-stop" title="Pause everything" delay={0}>
            One tap pauses every agent. Nothing more is sent.
          </SafetyCard>
          <SafetyCard art="paper-plane" title="Withdraw anytime" delay={100}>
            Your cash is USDC in your own account. Send it anywhere on Base.
          </SafetyCard>
          <SafetyCard
            art="receipt"
            title="Every trade, accounted for"
            delay={200}
            className="md:col-span-2 lg:col-span-1"
          >
            Each fill is a transaction on Base, with its price and costs in your activity.
          </SafetyCard>
        </ul>
      </div>
    </section>
  )
}
