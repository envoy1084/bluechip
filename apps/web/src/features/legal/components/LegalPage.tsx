import type { ReactNode } from "react"
import { OnboardingFrame } from "../../../components/layout/OnboardingFrame.tsx"

/** A legal page: the onboarding frame with one readable column of headed sections. */
export function LegalPage(
  { title, updated, intro, sections }: Readonly<{
    title: string
    updated: string
    intro: ReactNode
    sections: ReadonlyArray<readonly [heading: string, body: ReactNode]>
  }>
) {
  return (
    <OnboardingFrame wide>
      <article className="grid w-full gap-6 text-left">
        <header className="grid gap-2">
          <span className="text-label-sm font-medium text-g-500">Last updated {updated}</span>
          <h1 className="text-[28px] leading-[1.12] font-semibold tracking-[-0.035em]">{title}</h1>
          <p className="text-[15px] text-g-600">{intro}</p>
        </header>
        {sections.map(([heading, body]) => (
          <section key={heading} className="grid gap-1.5">
            <h2 className="text-base font-semibold tracking-[-0.02em]">{heading}</h2>
            <p className="text-[14.5px] leading-relaxed text-g-600">{body}</p>
          </section>
        ))}
      </article>
    </OnboardingFrame>
  )
}
