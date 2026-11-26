import type { Judgment } from "@bluechip/domain/automations/Run"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { choiceLabel } from "../../model/automationText.ts"

/**
 * A model's answer to one condition: the question, yes or no, how sure on a bar against how sure it had to be
 * (`neededBps`, when the automation says), its reason and the story it read.
 */
export function JudgmentCard(
  { judgment, neededBps }: Readonly<{ judgment: Judgment; neededBps: number | null }>
) {
  const { answer } = judgment
  const sure = Math.round(answer.confidence * 100)
  const needed = neededBps === null ? null : Math.round(neededBps / 100)

  return (
    <div className="grid gap-2.5 rounded-[12px] bg-white px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-g-200)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-label-sm">
          <span className="grid size-6 place-items-center rounded-full bg-blue-50 text-blue">
            <Icon name="sparkline" size={13} />
          </span>
          <b className="font-semibold text-ink">{choiceLabel("judgment", "preset", judgment.preset, {})}?</b>
        </span>
        <StatusPill tone={answer.verdict ? "pending" : "neutral"}>
          {answer.verdict ? "Yes" : "No"}, {sure}% sure
        </StatusPill>
      </div>

      <div className="grid gap-1">
        <div aria-hidden className="relative h-2 rounded-full bg-g-100">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-brand motion-reduce:transition-none",
              answer.verdict && (needed === null || sure >= needed) ?
                "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))]" :
                "bg-g-400"
            )}
            style={{ width: `${sure}%` }}
          />
          {needed === null ? null : (
            <i
              aria-hidden
              className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink/60"
              style={{ left: `${needed}%` }}
            />
          )}
        </div>
        {needed === null ? null : <span className="text-caption text-g-500">It needed {needed}% sure to count.</span>}
      </div>

      <p className="text-label-sm text-pretty text-g-700">{answer.reason}</p>

      <p className="flex items-start gap-1.5 border-t border-g-100 pt-2 text-caption text-g-500">
        <Icon name="news" size={13} className="mt-px shrink-0" />
        <span>
          Read “{judgment.inputs.headline}”, answered by the assistant
        </span>
      </p>
    </div>
  )
}
