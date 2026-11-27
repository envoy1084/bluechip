import { createFileRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { AppIcons } from "../pages/social/appIcons.tsx"
import { DefaultCard, LegalCard, PaperCard } from "../pages/social/cards.tsx"
import { AgentsCard, AssistantCard, AutomationsCard, SafetyCard } from "../pages/social/sectionCards.tsx"

export const Route = createFileRoute("/social")({ component: KitSocial })

function Shown({ name, use, children }: Readonly<{ name: string; use: string; children: ReactNode }>) {
  return (
    <figure className="grid gap-3">
      <figcaption className="grid gap-0.5">
        <b className="text-body font-semibold">{name}</b>
        <span className="text-body-sm text-g-600">{use}</span>
      </figcaption>
      {/* No rounding or clipping here: the capture takes the frame exactly as drawn. */}
      <div className="w-fit max-w-full overflow-x-auto shadow-e3">{children}</div>
    </figure>
  )
}

// The web app's link previews and icons at their real pixel sizes. `node scripts/bin.ts og` captures each
// `data-capture` element from this page into apps/web/public/.
function KitSocial() {
  return (
    <div className="grid gap-12 px-4 py-12 md:px-10">
      <div className="grid max-w-[64ch] gap-3">
        <span className="text-caption-sm font-semibold tracking-[.06em] text-blue uppercase">Social images</span>
        <h1 className="text-display-3 font-semibold">Link previews and icons.</h1>
        <p className="text-body-lg text-g-600">
          What a shared bluechip link shows, at 1200 × 630, and the icons the web app installs with. Run node
          scripts/bin.ts og to render them into the web app.
        </p>
      </div>
      <Shown name="Default" use="The landing and every page without its own image">
        <DefaultCard />
      </Shown>
      <Shown name="Paper money" use="Every page of paper.bluechip.markets">
        <PaperCard />
      </Shown>
      <Shown name="Agents" use="Agents, a new agent, an agent's page">
        <AgentsCard />
      </Shown>
      <Shown name="Automations" use="Automations and their pages">
        <AutomationsCard />
      </Shown>
      <Shown name="Assistant" use="The assistant's chat and its memory">
        <AssistantCard />
      </Shown>
      <Shown name="Safety" use="Security settings and account recovery">
        <SafetyCard />
      </Shown>
      <Shown name="Legal" use="Terms, privacy policy and risk disclosure">
        <LegalCard />
      </Shown>
      <section className="grid gap-3">
        <b className="text-body font-semibold">App icons</b>
        <AppIcons />
      </section>
    </div>
  )
}
