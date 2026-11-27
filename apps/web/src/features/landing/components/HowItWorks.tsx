import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

const STEPS: ReadonlyArray<{ readonly art: IllustrationName; readonly title: string; readonly text: string }> = [
  { art: "passkey", title: "Sign up with Face ID", text: "No password. No seed phrase." },
  { art: "wallet", title: "Add cash", text: "Send USDC to your account." },
  { art: "butterfly", title: "Hire an agent", text: "Pick what it trades and how much." },
  { art: "rising-chip", title: "Let it trade", text: "It asks you before big trades." }
]

/** Four steps from arriving to an agent at work, each on a plate with its pixel object. */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="landing-how" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="How it works" title={<span id="landing-how">Four steps, two minutes</span>} />

        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 120} className="grid">
              <div className="grid content-start overflow-hidden rounded-2xl bg-white shadow-e2 transition-[translate,box-shadow] duration-slow ease-brand hover:-translate-y-1 hover:shadow-e3">
                <div className="relative grid h-[180px] place-items-center bg-[radial-gradient(circle_at_50%_55%,var(--color-blue-50),#fff_72%)]">
                  <span className="absolute top-4 left-5 font-pixel text-[22px] font-extrabold text-blue-200">
                    {index + 1}
                  </span>
                  <Illustration name={step.art} size={100} aria-hidden />
                </div>
                <div className="grid gap-1 px-5 pt-4 pb-5">
                  <h3 className="text-title-3 font-semibold">{step.title}</h3>
                  <p className="text-body-sm text-g-600">{step.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
