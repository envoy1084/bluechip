import { type TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { ActivityFeed } from "./ActivityFeed.tsx"
import { AutomationStory } from "./AutomationStory.tsx"
import { Reveal } from "./Reveal.tsx"
import { SectionIntro } from "./SectionIntro.tsx"

/** What someone might say in chat to start each template. */
const ASKS: Readonly<Record<TemplateId, string>> = {
  stockPicker: "Trade Nvidia and Apple for me, up to $100 a day",
  weeklyBuyer: "Buy $50 of Microsoft every Monday",
  rebalancer: "Keep my money split evenly across four big tech stocks",
  stopLossGuard: "Sell my Tesla if it falls under a price I pick"
}

const ORDER: ReadonlyArray<TemplateId> = ["stockPicker", "weeklyBuyer", "rebalancer", "stopLossGuard"]

/** The agents: four templates to start from, a feed of them at work, and automations as sentences. */
export function AgentsShowcase() {
  return (
    <section id="agents" aria-labelledby="landing-agents" className="scroll-mt-20 bg-white px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto grid max-w-[1200px] gap-12">
        <SectionIntro kicker="Agents" title={<span id="landing-agents">Agents that work while you don't</span>}>
          Start from one of four agents or describe your own. Each gets its own pixel butterfly, its own limits and a
          journal of what it did and why.
        </SectionIntro>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER.map((id, index) => {
            const template = TEMPLATES[id]
            return (
              <Reveal
                as="li"
                key={id}
                delay={index * 110}
                className="grid"
              >
                <div className="group grid content-start gap-3 rounded-2xl bg-[linear-gradient(180deg,#fff,var(--color-g-50))] p-5 shadow-e2 transition-[translate,box-shadow] duration-slow ease-brand hover:-translate-y-1 hover:shadow-e3">
                  <AgentAvatar
                    agentId={template.title}
                    size="xl"
                    className="transition-transform duration-slow ease-spring group-hover:-rotate-3 group-hover:scale-105"
                  />
                  <b className="mt-1 text-title-3 font-semibold">{template.title}</b>
                  <p className="text-body-sm text-g-600">{template.summary}</p>
                  <q className="mt-1 rounded-[12px_12px_12px_4px] bg-white px-3 py-2 text-label text-g-700 shadow-hair">
                    {ASKS[id]}
                  </q>
                </div>
              </Reveal>
            )
          })}
        </ul>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <ActivityFeed />
          </Reveal>
          <Reveal delay={120}>
            <AutomationStory />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
