import { describeDecision } from "@bluechip/domain/intents/Describe"
import type { Decision } from "@bluechip/domain/intents/Intent"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { clockTime } from "./intentText.ts"

const LOOK: Readonly<Record<Decision["_tag"], { readonly icon: IconName; readonly tone: string }>> = {
  Passes: { icon: "check-circle", tone: "text-gain" },
  OverLargestTrade: { icon: "face-id", tone: "text-blue" },
  Refused: { icon: "stop-sign", tone: "text-loss" },
  Wait: { icon: "clock", tone: "text-warn" }
}

/** What the pipeline decided, in a sentence with its icon; a wait says when it tries again. */
export function DecisionLine({ decision, className }: Readonly<{ decision: Decision; className?: string }>) {
  const { icon, tone } = LOOK[decision._tag]

  return (
    <span className={cn("flex items-start gap-1.5 text-label-sm font-[550]", tone, className)}>
      <Icon name={icon} size={14} className="mt-px shrink-0" />
      <span>
        {describeDecision(decision)}
        {decision._tag === "Wait" ? ` It tries again at ${clockTime(decision.until)}.` : null}
      </span>
    </span>
  )
}
