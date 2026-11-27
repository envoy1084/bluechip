import { type GlanceView, LimitsDemo } from "./LimitsDemo.tsx"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

/** The limits: the promise in a line, then an agent's rules set and locked with the new-agent flow's own pieces. */
export function Limits({ Glance }: Readonly<{ Glance: GlanceView }>) {
  return (
    <section
      id="limits"
      aria-labelledby="landing-limits"
      className="scroll-mt-20 bg-[linear-gradient(180deg,#fff,var(--color-blue-50)_40%,#fff)] px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro
          kicker="Limits"
          align="center"
          title={<span id="landing-limits">You set the limits. bluechip enforces them.</span>}
        >
          Checked onchain on every trade. Only your Face ID can change them.
        </SectionIntro>
        <Reveal delay={120}>
          <LimitsDemo Glance={Glance} />
        </Reveal>
      </div>
    </section>
  )
}
