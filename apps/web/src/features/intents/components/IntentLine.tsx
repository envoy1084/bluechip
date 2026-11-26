import type { IntentId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { intentAtom } from "../atoms/intents.ts"
import { useLatestIntent } from "../hooks/useLatestIntent.ts"
import { shownDecision, STATUS } from "../model/intentText.ts"
import { DecisionLine } from "./DecisionLine.tsx"

function Line({ intent: fetched }: Readonly<{ intent: Intent }>) {
  const intent = useLatestIntent(fetched)
  const { nameOf } = useStockLookup()
  const status = STATUS[intent.status]
  const decision = shownDecision(intent)
  const waiting = intent.status === "needsApproval" || intent.status === "awaitingSignature"

  return (
    <div className="grid gap-1 rounded-[10px] px-3 py-2.5 surface-well">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Icon name={intent.leg.side === "buy" ? "arrow-down-right" : "arrow-up-right"} size={14} />
          <b className="text-label font-semibold text-ink">{describeLeg(intent.leg, nameOf)}</b>
          <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", status.tone)}>
            {status.label}
          </span>
        </span>
        {waiting ?
          (
            <ButtonLink size="xs" render={<Link to="/approvals" />}>
              <Icon name="face-id" size={14} />Review
            </ButtonLink>
          ) :
          null}
      </div>
      {decision === null ? null : <DecisionLine decision={decision} />}
    </div>
  )
}

/** One trade by its id, as it stands now: the trade in words, where it is, and what its policies decided. */
export function IntentLine({ id }: Readonly<{ id: IntentId }>) {
  const intent = useAtomValue(intentAtom(id))
  if (AsyncResult.isSuccess(intent)) return <Line intent={intent.value} />
  if (AsyncResult.isInitial(intent)) return <SkeletonBlock className="h-11 w-full rounded-[10px]" />
  return <p className="text-label-sm text-g-500">We couldn't load this trade just now.</p>
}
