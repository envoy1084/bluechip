import { describeLeg } from "@bluechip/domain/intents/Describe"
import { type Intent, isEnded } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useApproveIntent } from "../../hooks/useApproveIntent.ts"
import { nothingMoved, STATUS } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

// What an ended intent that sent nothing says.
const ENDED_QUIETLY: Partial<Record<Intent["status"], string>> = {
  declined: "You declined it.",
  expired: "It ran out before it was sent.",
  cancelled: "You cancelled it."
}

/** The intent's way through Base, once it's sent. */
function OnBase({ intent }: Readonly<{ intent: Intent }>) {
  const state = intent.status === "confirming" || intent.status === "filled" || intent.status === "failed" ?
    intent.status :
    "sending"

  return (
    <TransactionStatus
      state={state}
      orientation="vertical"
      failureReason={`Base didn't take it. ${nothingMoved(intent.leg.side)}`}
    />
  )
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
 * A trade you asked the agent for, followed live: checked against its policies, then sent by the agent, waiting for
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
  const status = STATUS[intent.status]
  const deciding = intent.status === "proposed" || intent.status === "deciding"
  const sent = intent.status === "sending" || intent.status === "confirming" || intent.status === "filled" ||
    intent.status === "failed"
  const needsYou = intent.status === "needsApproval" || intent.status === "awaitingSignature"
  const quiet = ENDED_QUIETLY[intent.status]

  return (
    <div className="grid gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[14.5px] font-semibold">{describeLeg(intent.leg, nameOf)}</b>
        <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", status.tone)}>
          {status.label}
        </span>
      </div>

      {deciding ?
        (
          <p className="flex items-center gap-2 text-label-sm text-g-600">
            <Spinner size={14} />Checking it against the agent's policies…
          </p>
        ) :
        null}
      {intent.decision !== null && !deciding && (!sent || intent.decision._tag === "Passes") ?
        <DecisionLine decision={intent.decision} /> :
        null}
      {intent.status === "blocked" || quiet !== undefined ?
        (
          <p className="inline-flex items-center gap-1.5 text-label-sm text-g-600">
            <Icon name="shield" size={14} />
            {quiet === undefined ? nothingMoved(intent.leg.side) : `${quiet} ${nothingMoved(intent.leg.side)}`}
          </p>
        ) :
        null}
      {sent ? <OnBase intent={intent} /> : null}
      {needsYou ?
        <ApproveHere flow={flow} onApprove={() => void approve()} onDecline={() => void decline()} /> :
        null}

      <div className="flex flex-wrap justify-end gap-2">
        {intent.status === "waiting" || intent.status === "proposed" ? <CancelIntentButton intent={intent} /> : null}
        {isEnded(intent.status) && onDone !== undefined ?
          (
            <Button variant="secondary" onClick={onDone}>
              {intent.status === "filled" ? "Trade again" : "Done"}
            </Button>
          ) :
          null}
      </div>
    </div>
  )
}
