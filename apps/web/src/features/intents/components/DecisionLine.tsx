import { describeDecision } from "@bluechip/domain/intents/Describe"
import type { Decision } from "@bluechip/domain/intents/Intent"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { clockTime } from "../model/intentText.ts"

const LOOK: Readonly<Record<Decision["_tag"], { readonly icon: IconName; readonly tone: string }>> = {
  Passes: { icon: "check-circle", tone: "text-gain" },
  OverLargestTrade: { icon: "face-id", tone: "text-blue" },
  Ask: { icon: "face-id", tone: "text-blue" },
  Refused: { icon: "stop-sign", tone: "text-loss" },
  Wait: { icon: "clock", tone: "text-warn" }
}

/**
 * What the pipeline decided, in a sentence with its icon; a wait says when it tries again. `besideStatus`: shown next to
 * a status that already says "Blocked", so a refusal names only the policy and why.
 */
export function DecisionLine(
  { decision, besideStatus = false, className }: Readonly<{
    decision: Decision
    besideStatus?: boolean
    className?: string
  }>
) {
  const { icon, tone } = LOOK[decision._tag]
  const text = besideStatus && decision._tag === "Refused" ?
    `${policyOf(decision.policy).title}: ${decision.message}` :
    describeDecision(decision)

  return (
    <span className={cn("flex items-start gap-1.5 text-label-sm font-[550]", tone, className)}>
      <Icon name={icon} size={14} className="mt-px shrink-0" />
      <span>
        {text}
        {decision._tag === "Wait" ? ` It tries again at ${clockTime(decision.until)}.` : null}
      </span>
    </span>
  )
}
