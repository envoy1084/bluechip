import { describeLeg } from "@bluechip/domain/intents/Describe"
import { type Intent, isEnded } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ChatCardState } from "@bluechip/ui/bluechip/chat-card"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { Icon } from "@bluechip/ui/icons/icon"
import { useNow } from "../../../../hooks/useNow.ts"
import { INTENT_STATUS } from "../../../../lib/intentStatus.ts"
import { describeTrades, nothingMoved, tradeOutcome, type TradeStage } from "../../../../lib/tradeOutcome.ts"
import { useApprovalGroup } from "../../hooks/useApprovalGroup.ts"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { sentLeg, shownDecision } from "../../model/intentText.ts"
import { ApprovalBody } from "../approvals/ApprovalBody.tsx"
import { DecisionLine } from "../DecisionLine.tsx"
import { FilledTrade } from "../FilledTrade.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

// What an ended intent that sent nothing says.
const ENDED_QUIETLY: Partial<Record<Intent["status"], string>> = {
  declined: "You declined it.",
  expired: "It ran out before it was sent.",
  cancelled: "You cancelled it."
}

/**
 * A trade you asked the agent for (or your own, once signed), followed live, with its receipt once it fills: checked
 * against its policies, then sent by the agent, waiting for your Face ID (the shared approval body, with the trades
 * of its plan sent with it), blocked by a policy, or waiting to be tried again. With `onDone`, an ended trade offers
 * to start another.
 */
export function AgentTradeProgress(
  { intent: asked, nameOf, onDone }: Readonly<{
    intent: Intent
    nameOf: (symbol: StockSymbol) => string
    onDone?: () => void
  }>
) {
  const together = useApprovalGroup(asked)
  const approval = useApproveIntent(asked, together)
  const { flow, intent } = approval
  const now = useNow(30_000)
  const status = INTENT_STATUS[intent.status]
  const decision = shownDecision(intent)
  const deciding = intent.status === "proposed" || intent.status === "deciding"
  const stage: TradeStage | null = intent.status === "sending" || intent.status === "confirming" ||
      intent.status === "filled" || intent.status === "failed" ?
    intent.status :
    null
  const needsYou = intent.status === "needsApproval" || intent.status === "awaitingSignature"
  const quiet = ENDED_QUIETLY[intent.status]

  const trade = together.length === 0 ?
    describeLeg(intent.leg, nameOf) :
    describeTrades([intent, ...together].map((leg) => sentLeg(leg, nameOf)))
  const again = isEnded(intent.status) && onDone !== undefined ?
    (
      <Button variant="secondary" onClick={onDone}>
        {intent.status === "filled" ? "Trade again" : "Done"}
      </Button>
    ) :
    null

  // Once sent, Base takes a couple of seconds: one place that turns from the wait into the fill or the failure, then
  // the receipt of what filled.
  // Approved here with others of its plan: the approval body follows every trade sent with the signature.
  if (stage !== null && !(flow.status === "approved" && together.length > 0)) {
    const text = tradeOutcome(stage, intent.leg.side, trade)
    return (
      <div className="grid gap-3">
        <Outcome tone={text.tone} title={text.title} description={text.description} actions={again ?? undefined} />
        {stage === "filled" && intent.tradeId !== null ? <FilledTrade id={intent.tradeId} withTx /> : null}
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[15px] font-semibold tracking-[-0.01em]">{trade}</b>
        <ChatCardState>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </ChatCardState>
      </div>

      {deciding ?
        (
          <p className="flex items-center gap-2 text-label-sm text-g-600">
            <Spinner size={14} />Checking it against the agent's policies…
          </p>
        ) :
        null}
      {decision !== null && !deciding && !needsYou ? <DecisionLine decision={decision} /> : null}
      {intent.status === "blocked" || quiet !== undefined ?
        (
          <p className="inline-flex items-center gap-1.5 text-label-sm text-g-600">
            <Icon name="shield" size={14} />
            {quiet === undefined ? nothingMoved(intent.leg.side) : `${quiet} ${nothingMoved(intent.leg.side)}`}
          </p>
        ) :
        null}
      {needsYou || flow.status === "approved" ?
        <ApprovalBody approval={approval} together={together} now={now} /> :
        null}

      {intent.status === "waiting" || intent.status === "proposed" || again !== null ?
        (
          <div className="flex flex-wrap justify-end gap-2">
            {intent.status === "waiting" || intent.status === "proposed" ?
              <CancelIntentButton intent={intent} /> :
              null}
            {again}
          </div>
        ) :
        null}
    </div>
  )
}
