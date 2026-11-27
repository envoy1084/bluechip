import { Illustration, type IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { useRef } from "react"
import { useInView } from "../hooks/useInView.ts"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

const STEPS: ReadonlyArray<{ readonly art: IllustrationName; readonly title: string; readonly text: string }> = [
  {
    art: "passkey",
    title: "Make an account with Face ID",
    text: "A passkey creates your account on Base in a few seconds. No password and no seed phrase to lose."
  },
  {
    art: "wallet",
    title: "Add cash",
    text: "Send USDC on Base to your account's address, or scan its QR code with your wallet. It's yours to withdraw."
  },
  {
    art: "butterfly",
    title: "Hire an agent",
    text:
      "Start from a template or describe it in chat. You see what it can and can never do, then lock it with Face ID."
  },
  {
    art: "chart",
    title: "It trades, and asks when it should",
    text: "Trades inside its limits go through on their own. Anything over its largest trade waits for your approval."
  }
]

/** Four steps from arriving to an agent at work, joined by a line that draws itself as the steps arrive. */
export function HowItWorks() {
  const list = useRef<HTMLDivElement>(null)
  const drawn = useInView(list)

  return (
    <section id="how" aria-labelledby="landing-how" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-14">
        <SectionIntro kicker="How it works" title={<span id="landing-how">From Face ID to your first agent</span>}>
          About two minutes, start to finish. Your money stays in your own account the whole time.
        </SectionIntro>

        <div ref={list} className="grid gap-5">
          {/* The path through the steps: the line draws left to right and each step's dot lands as it passes. */}
          <div aria-hidden className="relative hidden h-3 lg:block">
            <span
              data-drawn={drawn || undefined}
              className="absolute inset-x-[12.5%] top-1/2 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,var(--color-blue),var(--color-cerulean))] transition-transform delay-200 duration-[1600ms] ease-in-out data-drawn:scale-x-100 motion-reduce:scale-x-100 motion-reduce:transition-none"
            />
            {STEPS.map((step, index) => (
              <span
                key={step.title}
                data-drawn={drawn || undefined}
                className="absolute top-0 size-3 -translate-x-1/2 scale-0 rounded-full bg-blue shadow-[0_0_0_4px_var(--color-blue-100)] transition-transform duration-slow ease-spring data-drawn:scale-100 motion-reduce:scale-100 motion-reduce:transition-none"
                style={{ left: `${12.5 + index * 25}%`, transitionDelay: `${200 + index * 520}ms` }}
              />
            ))}
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <Reveal
                as="li"
                key={step.title}
                delay={index * 140}
                className="grid"
              >
                <div className="grid content-start gap-3 rounded-2xl bg-white p-6 shadow-e2 transition-[translate,box-shadow] duration-slow ease-brand hover:-translate-y-1 hover:shadow-e3">
                  <div className="flex items-center justify-between">
                    <span className="grid size-[72px] place-items-center rounded-[20px] bg-[linear-gradient(180deg,#fff,var(--color-blue-50))] shadow-[inset_0_0_0_1px_var(--color-info-line),0_8px_20px_-12px_rgba(42,91,255,.5)]">
                      <Illustration name={step.art} size={48} aria-hidden />
                    </span>
                    <span className="font-pixel text-[28px] font-extrabold text-blue-200 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-title-3 font-semibold">{step.title}</h3>
                  <p className="text-body-sm text-g-600">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
