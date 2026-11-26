import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import { PageSection } from "../../../components/layout/PageSection.tsx"
import { localTimeZone, yourTime } from "../../../lib/localTime.ts"
import type { ComingUp, Upcoming } from "../model/comingUp.ts"
import { dayWord } from "../model/time.ts"

function UpcomingLink({ upcoming }: Readonly<{ upcoming: Upcoming }>) {
  const className = "text-body-sm font-semibold hover:underline focus-visible:underline"

  return upcoming._tag === "run" ?
    (
      <Link to="/automations/$automationId" params={{ automationId: upcoming.automationId }} className={className}>
        {upcoming.title}
      </Link>
    ) :
    (
      <Link to="/agents/$agentId" params={{ agentId: upcoming.agentId }} className={className}>
        {upcoming.title}
      </Link>
    )
}

/**
 * The coming week as a short timeline: automations' next runs and agents' rules ending, then what live automations
 * watch. Nothing at all when nothing is coming.
 */
export function ComingUpCard({ comingUp, now }: Readonly<{ comingUp: ComingUp; now: Date }>) {
  const zone = localTimeZone()
  if (comingUp.upcoming.length === 0 && comingUp.watching.length === 0) return null

  return (
    <PageSection title="Coming up">
      <div className="grid gap-3 rounded-lg bg-white px-4 py-3.5 shadow-e2">
        {comingUp.upcoming.length === 0 ? null : (
          <ol className="grid">
            {comingUp.upcoming.map((upcoming) => (
              <li
                key={upcoming.key}
                className="relative grid grid-cols-[12px_minmax(0,1fr)] gap-x-3 pb-3.5 last:pb-0 [&:last-child>i:last-of-type]:hidden"
              >
                <i
                  aria-hidden
                  className={upcoming._tag === "run" ?
                    "mt-[5px] size-2.5 rounded-full bg-white shadow-[inset_0_0_0_2px_var(--color-g-800)]" :
                    "mt-[5px] size-2.5 rounded-full bg-white shadow-[inset_0_0_0_2px_var(--color-warn)]"}
                />
                <i aria-hidden className="absolute top-[19px] bottom-0.5 left-[5px] w-px bg-g-200" />
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-label-sm text-g-500 tabular-nums">
                    {dayWord(upcoming.at, now, zone)}, {yourTime(upcoming.at, zone)}
                  </span>
                  <UpcomingLink upcoming={upcoming} />
                  {upcoming.detail === "" ? null : <span className="text-label-sm text-g-600">{upcoming.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {comingUp.watching.length === 0 ?
          null :
          (
            <ul className={comingUp.upcoming.length === 0 ? "grid gap-1.5" : "grid gap-1.5 border-t border-g-100 pt-3"}>
              {comingUp.watching.map((line) => (
                <li key={line} className="flex items-center gap-2 text-label-sm text-g-600">
                  <Icon name="eye" size={14} className="shrink-0 text-g-400" />
                  <span className="min-w-0 truncate">{line}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </PageSection>
  )
}
