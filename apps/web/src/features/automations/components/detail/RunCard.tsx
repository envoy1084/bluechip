import type { AutomationRun, Judgment } from "@bluechip/domain/automations/Run"
import type { IntentId } from "@bluechip/domain/Ids"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatDate } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import type { ComponentType } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { choiceLabel, judgmentText, OUTCOME } from "../../model/automationText.ts"
import { catalogEntry } from "../../model/drafts.ts"
import { StatusPill } from "../StatusPill.tsx"

/** A model's answer to one condition: the question, yes or no and how sure, why, and the story it read. */
function ModelAnswer({ judgment }: Readonly<{ judgment: Judgment }>) {
  return (
    <div className="grid gap-1 rounded-[10px] px-3 py-2.5 surface-well">
      <span className="flex flex-wrap items-center gap-1.5 text-label-sm">
        <b className="font-semibold text-ink">{choiceLabel("judgment", "preset", judgment.preset, {})}?</b>
        <span className="text-g-600">{judgmentText(judgment.answer)}</span>
      </span>
      <p className="text-label-sm text-g-700">{judgment.answer.reason}</p>
      <p className="text-caption text-g-500">Read “{judgment.inputs.headline}”</p>
    </div>
  )
}

/**
 * One run: when it started and how it ended, what started it, each condition with its result and reason (and a
 * model's answer where one decided it), why it ended so, and the trades it proposed.
 */
export function RunCard(
  { run, judgments, Intent }: Readonly<{
    run: AutomationRun
    judgments: ReadonlyArray<Judgment>
    Intent: ComponentType<{ id: IntentId }>
  }>
) {
  const outcome = OUTCOME[run.outcome]

  return (
    <li className="grid gap-3 border-b border-g-100 px-[18px] py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink">
          {formatDate(DateTime.toDateUtc(run.firedAt), { timeZone: localTimeZone() })}
        </span>
        <StatusPill label={outcome.label} tone={outcome.tone} />
      </div>

      <p className="text-label text-g-700">{run.trigger.summary}</p>

      {run.conditions.length === 0 ? null : (
        <ul aria-label="Conditions" className="grid gap-2">
          {run.conditions.map((condition) => {
            const judgment = judgments.find((each) => each.id === condition.judgmentId)
            return (
              <li
                key={condition.judgmentId ?? `${condition.type}:${condition.reason}`}
                className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2"
              >
                <Icon
                  name={condition.pass ? "check" : "close"}
                  size={14}
                  label={condition.pass ? "Held" : "Didn't hold"}
                  className={cn("mt-[3px]", condition.pass ? "text-gain" : "text-loss")}
                />
                <span className="grid gap-1.5">
                  <span className="text-label-sm">
                    <b className="font-semibold text-ink">{catalogEntry("condition", condition.type).title}</b>{" "}
                    <span className="text-g-600">{condition.reason}</span>
                  </span>
                  {judgment === undefined ? null : <ModelAnswer judgment={judgment} />}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-label-sm text-g-500">{run.reason}</p>

      {run.intentIds.length === 0 ? null : (
        <ul aria-label="Trades it proposed" className="grid gap-2">
          {run.intentIds.map((id) => (
            <li key={id}>
              <Intent id={id} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
