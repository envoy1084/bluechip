import { AGENT_TEMPLATES } from "@bluechip/ui/bluechip/template-picker"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { ActivityFeed } from "./ActivityFeed.tsx"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

/** The agents: the four kinds bluechip makes, each with its object in halftone, and a feed of them at work. */
export function AgentsShowcase() {
  return (
    <section id="agents" aria-labelledby="landing-agents" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Agents" title={<span id="landing-agents">Four agents to start from</span>} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <ul className="grid gap-4 sm:grid-cols-2">
            {AGENT_TEMPLATES.map((template, index) => (
              <Reveal as="li" key={template.name} delay={index * 100} className="grid">
                <div className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 rounded-2xl bg-white p-4 shadow-e2 transition-[translate,box-shadow] duration-slow ease-brand hover:-translate-y-1 hover:shadow-e3">
                  <span className="grid size-24 place-items-center rounded-[20px] bg-[radial-gradient(circle_at_50%_55%,var(--color-blue-50),var(--color-g-50))]">
                    <Illustration name={template.illustration} size={60} aria-hidden />
                  </span>
                  <span className="grid content-center justify-items-start gap-1.5">
                    <b className="text-body font-semibold">{template.label}</b>
                    <span className="text-label text-g-600">{template.promise}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-caption font-semibold text-blue">
                      {template.rule}
                    </span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={150}>
            <ActivityFeed />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
