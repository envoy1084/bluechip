import type { Automation } from "@bluechip/domain/automations/Automation"
import type { AutomationRun, Judgment, RunOutcome } from "@bluechip/domain/automations/Run"
import type { IntentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import type { ComponentType } from "react"
import { RUN_OUTCOME } from "../../../../lib/automationWords.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { catalogEntry } from "../../model/drafts.ts"
import { AutomationSentence } from "../AutomationSentence.tsx"
import { JudgmentCard } from "./JudgmentCard.tsx"

/** Each outcome's mark on the timeline: its icon on its color. */
const NODE: Readonly<Record<RunOutcome, { readonly icon: IconName; readonly tone: string }>> = {
  proposed: { icon: "check", tone: "bg-gain text-white" },
  asked: { icon: "face-id", tone: "bg-blue text-white" },
  notified: { icon: "bell", tone: "bg-blue-100 text-blue-deep" },
  skipped: { icon: "minus", tone: "bg-g-100 text-g-500" },
  failed: { icon: "warning", tone: "bg-[#f5b400] text-ink" }
}

/** How sure a model had to be for a judgment, from the automation's own condition. */
const neededFor = (automation: Automation, judgment: Judgment): number | null => {
  const condition = automation.conditions.find((each) =>
    each.type === "judgment" && each.config.preset === judgment.preset
  )
  return condition?.type === "judgment" ? condition.config.minConfidenceBps : null
}

/**
 * One run on the timeline: its mark, the time and how it ended, what fired it, each condition it checked (passed or
 * not, with a model's answer where one decided it), why it ended so, and the trades it proposed.
 */
export function RunEntry(
  { automation, run, judgments, symbols, Intent, index }: Readonly<{
    automation: Automation
    run: AutomationRun
    judgments: ReadonlyArray<Judgment>
    symbols: ReadonlyArray<StockSymbol>
    Intent: ComponentType<{ id: IntentId }>
    index: number
  }>
) {
  const node = NODE[run.outcome]
  const outcome = RUN_OUTCOME[run.outcome]

  return (
    <li
      className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3.5 px-5 py-4 motion-safe:animate-slide-up"
      style={{ animationDelay: `${Math.min(index, 6) * 45}ms`, animationFillMode: "both" }}
    >
      <i aria-hidden className="absolute top-0 bottom-0 left-[33px] w-px bg-g-100" />
      <span
        aria-hidden
        className={cn(
          "relative z-[1] mt-px grid size-7 place-items-center rounded-full shadow-[0_0_0_4px_#fff]",
          node.tone
        )}
      >
        <Icon name={node.icon} size={14} />
      </span>

      <div className="grid min-w-0 gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-[14px] font-semibold text-ink tabular-nums">
            {formatTime(DateTime.toDateUtc(run.firedAt), { timeZone: localTimeZone() })}
          </b>
          <StatusPill tone={outcome.tone}>{outcome.label}</StatusPill>
        </div>

        <AutomationSentence sentence={run.trigger.summary} symbols={symbols} className="text-label text-g-700" />

        {run.conditions.length === 0 ? null : (
          <ul aria-label="Conditions" className="grid gap-2">
            {run.conditions.map((condition) => {
              const judgment = judgments.find((each) => each.id === condition.judgmentId)
              return (
                <li
                  key={condition.judgmentId ?? `${condition.type}:${condition.reason}`}
                  className="grid gap-2 rounded-[12px] px-3 py-2.5 surface-well"
                >
                  <span className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-2 text-label-sm">
                    <span
                      className={cn(
                        "grid size-5 place-items-center rounded-full",
                        condition.pass ? "bg-gain-wash text-gain" : "bg-loss-wash text-loss"
                      )}
                    >
                      <Icon
                        name={condition.pass ? "check" : "close"}
                        size={12}
                        label={condition.pass ? "Held" : "Didn't hold"}
                      />
                    </span>
                    <span>
                      <b className="font-semibold text-ink">{catalogEntry("condition", condition.type).title}</b>{" "}
                      <span className="text-g-600">{condition.reason}</span>
                    </span>
                  </span>
                  {judgment === undefined ?
                    null :
                    <JudgmentCard judgment={judgment} neededBps={neededFor(automation, judgment)} />}
                </li>
              )
            })}
          </ul>
        )}

        <p className="flex items-start gap-1.5 text-label-sm text-g-600">
          <Icon name="info" size={14} className="mt-px shrink-0 text-g-400" />
          {run.reason}
        </p>

        {run.intentIds.length === 0 ? null : (
          <div className="grid gap-1.5">
            <span className="text-caption font-semibold tracking-[0.02em] text-g-500 uppercase">
              {run.intentIds.length === 1 ? "The trade it proposed" : `The ${run.intentIds.length} trades it proposed`}
            </span>
            <ul aria-label="Trades it proposed" className="grid gap-2">
              {run.intentIds.map((id) => (
                <li key={id}>
                  <Intent id={id} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  )
}
