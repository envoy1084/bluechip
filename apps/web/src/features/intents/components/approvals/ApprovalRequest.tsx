import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { useStockLookup } from "../../../../hooks/useStockLookup.ts"
import { describeTrades } from "../../../../lib/tradeOutcome.ts"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { sentLeg } from "../../model/intentText.ts"
import { ApprovalBody } from "./ApprovalBody.tsx"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * An agent's trade waiting for you, as a card on the approvals page and in the sheet: who asks and what, then the
 * shared approval body (every trade sent with it, why, its deadline, Approve or Decline).
 */
export function ApprovalRequest(
  { intent: asked, together, agentName, now, onHandled, onDone }: Readonly<{
    intent: Intent
    together: ReadonlyArray<Intent>
    agentName: string
    now: Date
    /** Approve or Decline was pressed: keep the card until Done. */
    onHandled: () => void
    onDone: () => void
  }>
) {
  const approval = useApproveIntent(asked, together)
  const { nameOf } = useStockLookup()
  const trades = [approval.intent, ...together]
  const trade = trades.length === 1 ?
    describeLeg(approval.intent.leg, nameOf) :
    describeTrades(trades.map((intent) => sentLeg(intent, nameOf)))
  const title = approval.flow.status === "declined" ?
    `You declined: ${lowerFirst(trade)}` :
    approval.flow.status === "approved" ?
    `You approved: ${lowerFirst(trade)}` :
    `${agentName} wants to ${lowerFirst(trade)}`

  return (
    <section aria-label={title} className="grid gap-3.5 rounded-lg bg-white px-[18px] py-4 shadow-e2">
      <div className="flex items-center gap-3">
        <AgentAvatar agentId={asked.agentId ?? asked.id} size="lg" status="waiting" />
        <b className="min-w-0 flex-1 text-[15px] font-semibold tracking-[-0.01em]">
          <TextMorph>{title}</TextMorph>
        </b>
      </div>
      <ApprovalBody approval={approval} together={together} now={now} onHandled={onHandled} onDone={onDone} />
    </section>
  )
}
