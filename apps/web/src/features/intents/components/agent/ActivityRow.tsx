import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { TradeRow } from "../../../../components/TradeRow.tsx"
import { WhoChip } from "../../../../components/WhoChip.tsx"
import { track } from "../../../../lib/analytics.ts"
import { INTENT_STATUS } from "../../../../lib/intentStatus.ts"
import { nothingMoved } from "../../../../lib/tradeOutcome.ts"
import { useLatestIntent } from "../../hooks/useLatestIntent.ts"
import { clockTime, shownDecision } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { FilledTrade } from "../FilledTrade.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * One trade the agent was asked for, on the shared trade row: the stock, the trade and where it stands, who asked and why, what its policies
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
    <TradeRow
      lead={<TickerChip symbol={intent.leg.symbol} size="md" className="mt-0.5 self-start" />}
      title={describeLeg(intent.leg, nameOf)}
      status={waitingForYou ? null : status}
      time={{ at: DateTime.toDateUtc(intent.createdAt), text: clockTime(intent.createdAt) }}
      tone={waitingForYou ? "attention" : intent.status === "blocked" ? "failed" : "plain"}
    >
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
          <span className="mt-1">
            <CancelIntentButton intent={intent} />
          </span>
        ) :
        waitingForYou ?
        (
          <span className="mt-1">
            <ButtonLink
              size="sm"
              render={<Link to="/approvals" />}
              onClick={() => track({ _tag: "approval_opened", entry: "agent_page" })}
            >
              <Icon name="face-id" size={14} />Review and approve
            </ButtonLink>
          </span>
        ) :
        null}
    </TradeRow>
  )
}
