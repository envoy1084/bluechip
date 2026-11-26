import type { TradeId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { priceDollars, shareCount, usdcDollars } from "../../../../lib/amounts.ts"
import { nothingMoved } from "../../../../lib/tradeOutcome.ts"
import { tradeAtom } from "../../atoms/intents.ts"
import { useLatestIntent } from "../../hooks/useLatestIntent.ts"
import { clockTime, shownDecision, SOURCE, STATUS } from "../../model/intentText.ts"
import { DecisionLine } from "../DecisionLine.tsx"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

const SOURCE_ICON: Readonly<Record<Intent["source"], IconName>> = {
  owner: "user",
  assistant: "chat",
  automation: "zap",
  channel: "send",
  mcp: "link"
}

/** What a filled trade actually moved, from its receipt: shares, cash and the price they make. */
function Fill({ id }: Readonly<{ id: TradeId }>) {
  const trade = useAtomValue(tradeAtom(id))
  if (!AsyncResult.isSuccess(trade) || trade.value.status !== "filled") return null
  const { price, shares, side, usdc } = trade.value

  return (
    <dl className="mt-1 grid grid-cols-3 gap-3 rounded-[10px] px-3 py-2.5 surface-well">
      {[
        { label: side === "buy" ? "Paid" : "Got", value: formatMoney(usdcDollars(usdc)) },
        { label: side === "buy" ? "Shares bought" : "Shares sold", value: formatShareCount(shareCount(shares)) },
        { label: "Price", value: `${formatMoney(priceDollars(price))} a share` }
      ].map((fact) => (
        <div key={fact.label} className="grid gap-0.5">
          <dt className="text-caption text-g-500">{fact.label}</dt>
          <dd className="text-[13.5px] font-semibold tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

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
  const status = STATUS[intent.status]
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
      <TickerChip symbol={intent.leg.symbol} size="md" className="mt-0.5" />
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[14.5px] font-semibold tracking-[-0.01em]">{describeLeg(intent.leg, nameOf)}</b>
            <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", status.tone)}>
              {status.label}
            </span>
          </span>
          <span className="text-label-sm text-g-500 tabular-nums">{clockTime(intent.createdAt)}</span>
        </div>

        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-g-100 px-2 py-px text-[11.5px] font-medium text-g-700">
            <Icon name={SOURCE_ICON[intent.source]} size={12} />
            {SOURCE[intent.source]}
          </span>
          {intent.reason === "" ? null : <span className="min-w-0">{intent.reason}</span>}
        </span>

        {decision === null ? null : <DecisionLine decision={decision} />}
        {stopped ? <span className="text-label-sm text-g-600">{nothingMoved(intent.leg.side)}</span> : null}
        {intent.status === "filled" && intent.tradeId !== null ? <Fill id={intent.tradeId} /> : null}

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
