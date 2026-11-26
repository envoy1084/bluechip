import { TRIGGERS } from "@bluechip/domain/automations/Automation"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import type { ReactNode } from "react"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import type { Filter } from "../../model/standing.ts"
import { TriggerArt } from "../TriggerArt.tsx"

/**
 * No automations yet: a halftone bolt, what they do, every trigger they can start from (its illustration, title and
 * the catalog's first example), and the ways to make one.
 */
export function NoAutomations(
  { title, children, actions }: Readonly<{ title: string; children: ReactNode; actions?: ReactNode }>
) {
  return (
    <section
      aria-label={title}
      className="grid justify-items-center gap-6 rounded-lg bg-white px-5 py-8 text-center shadow-e2 sm:px-8"
    >
      <div className="grid justify-items-center gap-2">
        <Illustration name="bolt" variant="halftone" size={150} animate className="-my-2" />
        <h2 className="text-[22px] font-semibold tracking-[-0.025em]">{title}</h2>
        <p className="max-w-[52ch] text-body-sm text-pretty text-g-600">{children}</p>
      </div>

      <ul aria-label="What can start one" className="grid w-full gap-2.5 text-left sm:grid-cols-2 lg:grid-cols-3">
        {TRIGGERS.map((trigger, index) => (
          <li
            key={trigger.type}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md p-3 surface-well motion-safe:animate-slide-up"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
          >
            <TriggerArt type={trigger.type} />
            <span className="grid gap-0.5">
              <b className="text-[13.5px] font-semibold text-ink">{trigger.title}</b>
              <span className="text-label-sm text-g-600">“{trigger.examples[0]}”</span>
            </span>
          </li>
        ))}
      </ul>

      {actions === undefined ? null : <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </section>
  )
}

const FILTER_EMPTY: Readonly<
  Record<
    Exclude<Filter, "all">,
    { readonly illustration: "shield" | "moon" | "sun"; readonly title: string; readonly body: string }
  >
> = {
  active: {
    illustration: "moon",
    title: "Nothing running",
    body: "None of these automations is watching right now. Resume one to start it again."
  },
  paused: { illustration: "sun", title: "Nothing paused", body: "Every one of these automations is running or over." },
  attention: {
    illustration: "shield",
    title: "Nothing needs a look",
    body: "Every running automation's last run went through, and nothing is stopping it from trading."
  }
}

/** A filter that shows none of the automations. */
export function FilterEmpty({ filter }: Readonly<{ filter: Exclude<Filter, "all"> }>) {
  const empty = FILTER_EMPTY[filter]
  return (
    <div className="rounded-lg bg-white shadow-e2">
      <IllustratedEmpty illustration={empty.illustration} title={empty.title} size={120}>{empty.body}</IllustratedEmpty>
    </div>
  )
}
