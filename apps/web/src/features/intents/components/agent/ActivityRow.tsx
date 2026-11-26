import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import { WhoChip } from "../../../../components/WhoChip.tsx"
import { INTENT_STATUS } from "../../../../lib/intentStatus.ts"
import { nothingMoved } from "../../../../lib/tradeOutcome.ts"
import { useLatestIntent } from "../../hooks/useLatestIntent.ts"
import { clockTime, shownDecision } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { FilledTrade } from "../FilledTrade.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * One trade the agent was asked for: the stock, the trade and where it stands, who asked and why, what its policies
 * decided, what it filled at, and the trades planned with it (`plannedWith`, those on the same page).
 */
export function ActivityRow(
  { intent: listed, plannedWith, nameOf }: Readonly<{
    intent: Intent
    plannedWith: ReadonlyArray<Intent>
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  const intent = useLatestIntent(listed)
  const status = INTENT_STATUS[intent.status]
  const decision = shownDecision(intent)
  const stopped = intent.status === "blocked" || intent.status === "failed" || intent.status === "declined" ||
    intent.status === "expired" || intent.status === "cancelled"
  const waitingForYou = intent.status === "needsApproval" || intent.status === "awaitingSignature"

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-3.5 border-b border-g-100 px-5 py-4 last:border-b-0",
        waitingForYou && "bg-[linear-gradient(180deg,#f8f9ff,#f3f5ff)]",
        intent.status === "blocked" && "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)]"
      )}
    >
      <TickerChip symbol={intent.leg.symbol} size="md" className="mt-0.5 self-start" />
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[14.5px] font-semibold tracking-[-0.01em]">{describeLeg(intent.leg, nameOf)}</b>
            {waitingForYou ? null : <StatusPill tone={status.tone}>{status.label}</StatusPill>}
          </span>
          <span className="text-label-sm text-g-500 tabular-nums">{clockTime(intent.createdAt)}</span>
        </div>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-500">
          <WhoChip who={{ _tag: "source", source: intent.source }} />
          {intent.reason === "" ? null : <span className="min-w-0">{intent.reason}</span>}
        </span>

        {decision === null || waitingForYou ? null : <DecisionLine decision={decision} besideStatus />}
        {stopped ? <span className="text-label-sm text-g-600">{nothingMoved(intent.leg.side)}</span> : null}
        {intent.status === "filled" && intent.tradeId !== null ?
          <FilledTrade id={intent.tradeId} className="mt-1" /> :
          null}

        {plannedWith.length === 0 ?
          null :
          (
            <span className="flex flex-wrap items-center gap-1.5 text-label-sm text-g-500">
              <Icon name="layers" size={13} className="text-g-400" />
              Planned with {plannedWith.map((other) => lowerFirst(describeLeg(other.leg, nameOf))).join(", ")}
            </span>
          )}

        {intent.status === "waiting" || intent.status === "proposed" ?
          (
            <div className="mt-1">
              <CancelIntentButton intent={intent} />
            </div>
          ) :
          waitingForYou ?
          (
            <div className="mt-1">
              <ButtonLink size="sm" render={<Link to="/approvals" />}>
                <Icon name="face-id" size={14} />Review and approve
              </ButtonLink>
            </div>
          ) :
          null}
      </div>
    </li>
  )
}
