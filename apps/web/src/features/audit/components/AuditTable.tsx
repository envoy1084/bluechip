import type { AuditEvent } from "@bluechip/domain/audit/Audit"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import * as Array from "effect/Array"
import type { ReactNode } from "react"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { dayHeading } from "../../../lib/localTime.ts"
import { AuditRow } from "./AuditRow.tsx"

const headClassName =
  "sticky top-[60px] z-2 border-y border-g-100 bg-g-50/95 py-2 text-left text-caption font-semibold text-g-500 backdrop-blur-sm"

/** Rows of placeholders while a page loads. */
export function AuditSkeleton({ rows = 6 }: Readonly<{ rows?: number }>) {
  return (
    <div aria-busy className="grid">
      {Array.makeBy(rows, (row) => (
        <div
          key={row}
          className="grid grid-cols-[minmax(0,1fr)] items-center gap-4 border-b border-g-100 px-4 py-3 last:border-b-0 md:grid-cols-[80px_140px_minmax(0,1fr)_150px]"
        >
          <SkeletonBlock className="h-3.5 w-14 max-md:hidden" />
          <SkeletonBlock className="h-3.5 w-24 max-md:hidden" />
          <span className="flex items-center gap-3">
            <SkeletonBlock className="size-7 rounded-[8px]" />
            <SkeletonBlock className="h-3.5 w-3/5" />
          </span>
          <SkeletonBlock className="h-3.5 w-20 max-md:hidden" />
        </div>
      ))}
    </div>
  )
}

/** A page that didn't load, with a way to ask again. */
export function AuditProblem({ what, onRetry }: Readonly<{ what: string; onRetry: () => void }>) {
  return <LoadProblem what={what} onRetry={onRetry} size="sm" />
}

/**
 * The log as a table under a sticky header, its entries under their day's heading with the day's count, then what
 * follows them (the next page loading, or the way to load it).
 */
export function AuditTable(
  { events, agentName, now, timeZone, footer }: Readonly<{
    events: ReadonlyArray<AuditEvent>
    agentName: (id: string) => string | undefined
    now: Date
    timeZone: string
    footer: ReactNode
  }>
) {
  const days = Object.entries(Array.groupBy(events, (event) => dayHeading(event.at, now, timeZone)))

  return (
    <div className="rounded-lg bg-white shadow-e2">
      <table className="w-full border-separate border-spacing-0 text-body-sm">
        <caption className="sr-only">Audit log</caption>
        <thead className="max-md:hidden">
          <tr>
            <th scope="col" className={`${headClassName} rounded-tl-lg pr-2 pl-4`}>When</th>
            <th scope="col" className={`${headClassName} px-2`}>Who</th>
            <th scope="col" className={`${headClassName} px-2`}>What happened</th>
            <th scope="col" className={`${headClassName} px-2`}>About</th>
            <th scope="col" className={`${headClassName} rounded-tr-lg pr-3`}>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        {days.map(([day, dayEvents]) => (
          <tbody key={day} aria-label={day}>
            <tr>
              <th
                scope="colgroup"
                colSpan={5}
                className="border-b border-g-100 bg-white px-4 pt-4 pb-1.5 text-left text-caption font-semibold tracking-[0.02em] text-g-500 uppercase"
              >
                <span className="flex items-baseline justify-between gap-3">
                  {day}
                  <span className="font-medium tracking-normal normal-case text-g-400 tabular-nums">
                    {dayEvents.length} {dayEvents.length === 1 ? "entry" : "entries"}
                  </span>
                </span>
              </th>
            </tr>
            {dayEvents.map((event) => (
              <AuditRow key={event.id} event={event} agentName={agentName} now={now} timeZone={timeZone} />
            ))}
          </tbody>
        ))}
      </table>
      {footer}
    </div>
  )
}
