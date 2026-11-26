import type { IntentId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { ButtonLink } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { LoadProblem } from "../../../components/LoadProblem.tsx"
import { useStockLookup } from "../../../hooks/useStockLookup.ts"
import { INTENT_STATUS } from "../../../lib/intentStatus.ts"
import { intentAtom } from "../atoms/intents.ts"
import { useLatestIntent } from "../hooks/useLatestIntent.ts"
import { shownDecision } from "../model/intentText.ts"
import { DecisionLine } from "./DecisionLine.tsx"

function Line({ intent: fetched }: Readonly<{ intent: Intent }>) {
  const intent = useLatestIntent(fetched)
  const { nameOf } = useStockLookup()
  const status = INTENT_STATUS[intent.status]
  const decision = shownDecision(intent)
  const waiting = intent.status === "needsApproval" || intent.status === "awaitingSignature"

  return (
    <div className="grid gap-1 rounded-[10px] px-3 py-2.5 surface-well">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Icon name={intent.leg.side === "buy" ? "arrow-down-right" : "arrow-up-right"} size={14} />
          <b className="text-label font-semibold text-ink">{describeLeg(intent.leg, nameOf)}</b>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
  const refresh = useAtomRefresh(intentAtom(id))
  if (AsyncResult.isSuccess(intent)) return <Line intent={intent.value} />
  if (AsyncResult.isInitial(intent)) return <SkeletonBlock className="h-11 w-full rounded-[10px]" />
  return <LoadProblem what="this trade" onRetry={refresh} size="sm" />
}
