import type { AutomationDetail } from "@bluechip/domain/automations/Run"
import type { IntentId } from "@bluechip/domain/Ids"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import * as Array from "effect/Array"
import type { ComponentType } from "react"
import { dayHeading, localTimeZone } from "../../../../lib/localTime.ts"
import { stocksIn } from "../../model/sentence.ts"
import { nowLine } from "../../model/standing.ts"
import { RunEntry } from "./RunEntry.tsx"

/** What comes next, at the top of the timeline: its next time or what it watches, or that it's paused. */
function Upcoming({ detail, now }: Readonly<{ detail: AutomationDetail; now: Date }>) {
  const { automation } = detail
  const current = nowLine(automation, now, localTimeZone())
  const paused = current.kind === "paused"

  return (
    <div className="relative grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3.5 border-b border-g-100 bg-[linear-gradient(180deg,#f8f9ff,#f3f5ff)] px-5 py-3.5">
      <span
        aria-hidden
        className={cn(
          "grid size-7 place-items-center rounded-full border-[1.5px] border-dashed bg-white",
          paused ? "border-g-300 text-g-500" : "border-blue text-blue"
        )}
      >
        <Icon name={paused ? "pause" : current.kind === "next" ? "clock" : "eye"} size={14} />
      </span>
      <span className="grid gap-0.5">
        <b className="text-[14px] font-semibold text-ink">{current.text}</b>
        <span className="text-label-sm text-g-600">
          {paused
            ? `Once resumed, it runs ${automation.description.trigger}.`
            : `It runs ${automation.description.trigger}.`}
        </span>
      </span>
    </div>
  )
}

/**
 * Its runs as a timeline, newest first and grouped by day, under what comes next: each with what fired it, what it
 * checked, how it ended and the trades it proposed. `Intent` draws a trade; it comes from the intents feature.
 */
export function RunTimeline(
  { detail, now, Intent }: Readonly<{
    detail: AutomationDetail
    now: Date
    Intent: ComponentType<{ id: IntentId }>
  }>
) {
  const { automation, runs, judgments } = detail
  const ended = automation.status !== "active" && automation.status !== "paused"
  const symbols = stocksIn(automation)
  const days = Array.groupBy(runs, (run) => dayHeading(run.firedAt, now))

  return (
    <section aria-labelledby="runs" className="grid gap-3">
      <div className="grid gap-0.5 px-0.5">
        <h2 id="runs" className="text-[16px] font-semibold tracking-[-0.015em]">Runs</h2>
        <p className="text-label-sm text-g-500">
          Each time it fired: what started it, what it checked, and how it ended.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        {ended ? null : <Upcoming detail={detail} now={now} />}
        {runs.length === 0 ?
          (
            <p className="px-5 py-5 text-label text-g-600">
              {ended ? "It ended without running." : "No runs yet."}
            </p>
          ) :
          Object.entries(days).map(([day, dayRuns]) => (
            <section key={day} aria-label={day}>
              <h3 className="border-b border-g-100 bg-g-50/70 px-5 py-2 text-caption font-semibold tracking-[0.02em] text-g-500 uppercase">
                {day}
              </h3>
              <ol className="border-b border-g-100 last:border-b-0">
                {dayRuns.map((run, index) => (
                  <RunEntry
                    key={run.id}
                    automation={automation}
                    run={run}
                    judgments={judgments.filter((judgment) => judgment.runId === run.id)}
                    symbols={run.trigger.symbol === null ? symbols : [...symbols, run.trigger.symbol]}
                    Intent={Intent}
                    index={index}
                  />
                ))}
              </ol>
            </section>
          ))}
      </div>
    </section>
  )
}
