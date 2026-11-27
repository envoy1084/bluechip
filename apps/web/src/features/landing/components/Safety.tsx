import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { cn } from "@bluechip/ui/lib/cn"
import type { ReactNode } from "react"
import { Reveal } from "./Reveal.tsx"
import { FairPriceChart, RecoveryTrack } from "./SafetyVisuals.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

function SafetyCard(
  { icon, title, children, visual, delay, className }: Readonly<{
    icon: IconName
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
      <span className="grid size-10 place-items-center rounded-[12px] bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]">
        <Icon name={icon} size={19} />
      </span>
      <div className="grid gap-1.5">
        <h3 className="text-title-3 font-semibold">{title}</h3>
        <p className="max-w-[52ch] text-body-sm text-g-600">{children}</p>
      </div>
      {visual === undefined ? null : <div className="mt-auto pt-2">{visual}</div>}
    </Reveal>
  )
}

/** Why it's safe, each claim one thing the app or the chain does today. */
export function Safety() {
  return (
    <section
      id="safety"
      aria-labelledby="landing-safety"
      className="scroll-mt-20 bg-[linear-gradient(180deg,var(--color-g-50),#fff)] px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Safety" title={<span id="landing-safety">Safe by how it's built, not by a promise</span>}>
          Your account is a smart account on Base that only your passkeys own. Here is what that means day to day.
        </SectionIntro>

        <ul className="grid gap-4 lg:grid-cols-3">
          <SafetyCard
            icon="scales"
            title="Every trade checked against Chainlink"
            delay={0}
            className="lg:col-span-2"
            visual={<FairPriceChart />}
          >
            Each stock is priced by Chainlink's feed for it. A trade that would fill too far from that price doesn't
            happen, and nothing is traded.
          </SafetyCard>
          <SafetyCard
            icon="face-id"
            title="Face ID, not passwords"
            delay={100}
            className="lg:row-span-2"
            visual={
              <div className="grid place-items-center rounded-xl bg-[radial-gradient(circle_at_50%_40%,var(--color-blue-50),transparent_70%)] py-4">
                <Illustration name="passkey" variant="halftone" size={200} animate aria-hidden />
              </div>
            }
          >
            Your passkeys own your account. Your own trades, withdrawals and every change to an agent's limits are
            signed with Face ID or your fingerprint. There's no seed phrase to write down or lose.
          </SafetyCard>
          <SafetyCard
            icon="key"
            title="Recovery that waits 48 hours"
            delay={150}
            className="lg:col-span-2"
            visual={<RecoveryTrack />}
          >
            Lost every passkey? A recovery key can only ask to recover, and the request waits 48 hours onchain. You're
            told on every channel, and any signed-in device or Telegram can cancel it.
          </SafetyCard>
          <SafetyCard icon="hand" title="You approve the big ones" delay={0}>
            A trade over an agent's largest trade waits for your Face ID. Left unanswered, it expires after 6 hours and
            nothing is sent.
          </SafetyCard>
          <SafetyCard icon="pause" title="Pause everything at once" delay={100}>
            Pause one agent or all of them in a tap. A paused agent sends nothing, and its trades not yet sent are
            cancelled.
          </SafetyCard>
          <SafetyCard icon="wallet" title="Withdraw anytime" delay={200}>
            Your cash is USDC in your own account. Send it to any address on Base whenever you like, signed with your
            passkey.
          </SafetyCard>
        </ul>
      </div>
    </section>
  )
}
