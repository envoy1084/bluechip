import { TRIGGERS } from "@bluechip/domain/automations/Automation"
import type { AgentId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { Illustration } from "@bluechip/ui/illustrations/illustration"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { catalogEntry, whyUnavailable } from "../../model/drafts.ts"
import type { Filter } from "../../model/standing.ts"
import { TriggerArt } from "../TriggerArt.tsx"

const CARD = "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md p-3 surface-well"

/**
 * No automations yet: a halftone bolt, what they do, every trigger they can start from (its illustration, title and
 * the catalog's first example), and the ways to make one. With `start`, each example opens a new automation on that
 * trigger (for `start.agentId` when given), unless none of `start.specs` (the policies of whoever could trade it:
 * `null` for you) can run it, which it says instead.
 */
export function NoAutomations(
  { title, children, actions, start }: Readonly<{
    title: string
    children: ReactNode
    actions?: ReactNode
    start?: { readonly specs: ReadonlyArray<AgentSpec | null>; readonly agentId?: AgentId } | undefined
  }>
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
        {TRIGGERS.map((trigger, index) => {
          const unavailable = start === undefined ?
            null :
            start.specs.map((spec) =>
              whyUnavailable(catalogEntry("trigger", trigger.type), { spec, trigger: trigger.type })
            )
          const blocked = unavailable?.every((reason) => reason !== null) ? unavailable[0] ?? null : null
          const body = (
            <>
              <TriggerArt type={trigger.type} dimmed={blocked !== null} />
              <span className="grid gap-0.5">
                <b className="text-[13.5px] font-semibold text-ink">{trigger.title}</b>
                <span className="text-label-sm text-g-600">“{trigger.examples[0]}”</span>
                {blocked === null ? null : <span className="text-caption text-g-500">{blocked}</span>}
              </span>
            </>
          )
          return (
            <li
              key={trigger.type}
              className="grid motion-safe:animate-slide-up"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
            >
              {start === undefined || blocked !== null ?
                <div className={CARD}>{body}</div> :
                (
                  <Link
                    to="/automations/new"
                    search={{ trigger: trigger.type, ...(start.agentId === undefined ? {} : { agent: start.agentId }) }}
                    className={`${CARD} transition-shadow duration-fast ease-brand hover:shadow-[inset_0_0_0_1px_var(--color-blue)] focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none`}
                  >
                    {body}
                  </Link>
                )}
            </li>
          )
        })}
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
    title: "Nothing needs attention",
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
