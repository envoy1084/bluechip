import { describeLeg } from "@bluechip/domain/intents/Describe"
import { type Intent, isEnded } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ChatCardState } from "@bluechip/ui/bluechip/chat-card"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { INTENT_STATUS } from "../../../../lib/intentStatus.ts"
import { nothingMoved, tradeOutcome, type TradeStage } from "../../../../lib/tradeOutcome.ts"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { shownDecision } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { FilledTrade } from "../FilledTrade.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

// What an ended intent that sent nothing says.
const ENDED_QUIETLY: Partial<Record<Intent["status"], string>> = {
  declined: "You declined it.",
  expired: "It ran out before it was sent.",
  cancelled: "You cancelled it."
}

/** Approve with Face ID or Decline, for a trade over the agent's largest trade. */
function ApproveHere(
  { flow, onApprove, onDecline }: Readonly<{
    flow: ReturnType<typeof useApproveIntent>["flow"]
    onApprove: () => void
    onDecline: () => void
  }>
) {
  const busy = flow.status === "preparing" || flow.status === "signing" || flow.status === "declining"

  return (
    <div className="grid gap-2.5">
      {flow.status === "failed" ?
        (
          <Alert variant="destructive">
            <AlertDescription>{flow.message}</AlertDescription>
          </Alert>
        ) :
        null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" loading={flow.status === "declining"} disabled={busy} onClick={onDecline}>
          Decline
        </Button>
        <Button disabled={busy} aria-busy={busy || undefined} onClick={onApprove}>
          {flow.status === "preparing" || flow.status === "signing" ?
            <Spinner size={16} /> :
            <Icon name="face-id" size={16} />}
          <TextMorph>{flow.status === "signing" ? "Waiting for Face ID…" : "Approve with Face ID"}</TextMorph>
        </Button>
      </div>
    </div>
  )
}

/**
 * A trade you asked the agent for (or your own, once signed), followed live, with its receipt once it fills: checked against its policies, then sent by the agent, waiting for
 * your Face ID (approve it right here), blocked by a policy, or waiting to be tried again. With `onDone`, an ended
 * trade offers to start another.
 */
export function AgentTradeProgress(
  { intent: asked, nameOf, onDone }: Readonly<{
    intent: Intent
    nameOf: (symbol: StockSymbol) => string
    onDone?: () => void
  }>
) {
  const { approve, decline, flow, intent } = useApproveIntent(asked)
  const status = INTENT_STATUS[intent.status]
  const decision = shownDecision(intent)
  const deciding = intent.status === "proposed" || intent.status === "deciding"
  const stage: TradeStage | null = intent.status === "sending" || intent.status === "confirming" ||
      intent.status === "filled" || intent.status === "failed" ?
    intent.status :
    null
  const needsYou = intent.status === "needsApproval" || intent.status === "awaitingSignature"
  const quiet = ENDED_QUIETLY[intent.status]

  const trade = describeLeg(intent.leg, nameOf)
  const again = isEnded(intent.status) && onDone !== undefined ?
    (
      <Button variant="secondary" onClick={onDone}>
        {intent.status === "filled" ? "Trade again" : "Done"}
      </Button>
    ) :
    null

  // Once sent, Base takes a couple of seconds: one place that turns from the wait into the fill or the failure, then
  // the receipt of what filled.
  if (stage !== null) {
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
      {decision !== null && !deciding ? <DecisionLine decision={decision} /> : null}
      {intent.status === "blocked" || quiet !== undefined ?
        (
          <p className="inline-flex items-center gap-1.5 text-label-sm text-g-600">
            <Icon name="shield" size={14} />
            {quiet === undefined ? nothingMoved(intent.leg.side) : `${quiet} ${nothingMoved(intent.leg.side)}`}
          </p>
        ) :
        null}
      {needsYou ?
        <ApproveHere flow={flow} onApprove={() => void approve()} onDecline={() => void decline()} /> :
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
