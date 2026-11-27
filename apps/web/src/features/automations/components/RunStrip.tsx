import type { AutomationRun, RunResult } from "@bluechip/domain/automations/Run"
import { cn } from "@bluechip/ui/lib/cn"
import { stripLabel } from "../model/standing.ts"

/**
 * Each result's mark: green for a trade, amber-green for a part, red for a block, blue for a question or trades on
 * their way, dark grey for a message, light grey for a skip or nothing traded, amber for a failure.
 */
export const RESULT_MARK: Readonly<Record<RunResult, string>> = {
  traded: "bg-gain",
  partlyTraded: "bg-[linear-gradient(90deg,var(--color-gain)_50%,var(--color-loss)_50%)]",
  blocked: "bg-loss",
  notTraded: "bg-g-200",
  working: "bg-blue-100",
  asked: "bg-blue",
  notified: "bg-g-400",
  skipped: "bg-g-200",
  failed: "bg-[#f5b400]"
}

const SLOTS = ["1", "2", "3", "4", "5", "6", "7", "8"]

/**
 * The latest runs (newest first) as a row of marks, oldest on the left and the newest tallest, popping in one after
 * another (at once under reduced motion); said in words to screen readers.
 */
export function RunStrip(
  { runs, className }: Readonly<{ runs: ReadonlyArray<Pick<AutomationRun, "id" | "result">>; className?: string }>
) {
  const shown = runs.slice(0, SLOTS.length).toReversed()
  const empty = SLOTS.length - shown.length

  return (
    <span className={cn("flex h-4 items-end gap-[3px]", className)}>
      <span className="sr-only">{stripLabel(shown.map((run) => run.result))}</span>
      {SLOTS.map((slot, place) => {
        const run = shown[place - empty]
        if (run === undefined) return <i key={slot} aria-hidden className="h-1.5 w-[5px] rounded-full bg-g-100" />
        return (
          <i
            key={run.id}
            aria-hidden
            className={cn(
              "w-[5px] rounded-full motion-safe:animate-pop-in",
              run === shown.at(-1) ? "h-4" : "h-2.5",
              RESULT_MARK[run.result]
            )}
            style={{ animationDelay: `${(place - empty) * 30}ms`, animationFillMode: "both" }}
          />
        )
      })}
    </span>
  )
}
