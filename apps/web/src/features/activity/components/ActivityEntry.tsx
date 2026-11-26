import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Trade } from "@bluechip/domain/trading/Trade"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney, formatShareCount, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { IllustrationTile } from "../../../components/IllustrationTile.tsx"
import { WhoChip } from "../../../components/WhoChip.tsx"
import {
  activityAt,
  activityDetail,
  activityProblem,
  activityStatus,
  activityTitle
} from "../../../lib/activityText.ts"
import { bpsPercent, priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { localTimeZone } from "../../../lib/localTime.ts"

/** What leads the row: the stock's chip for a trade or a stock moved, a chip stack in or a paper plane out for cash. */
function Lead({ item }: Readonly<{ item: ActivityItem }>) {
  if (item._tag === "Trade") {
    return <TickerChip aria-hidden symbol={item.trade.symbol} size="md" className="mt-0.5 self-start" />
  }
  const { asset, kind } = item.transfer
  if (asset !== "USDC") return <TickerChip aria-hidden symbol={asset} size="md" className="mt-0.5 self-start" />
  return <IllustrationTile name={kind === "deposit" ? "chip-stack" : "paper-plane"} />
}

/** What a filled trade moved, from its receipt, and how its price compared with Chainlink's. */
function Facts({ trade }: Readonly<{ trade: Trade }>) {
  const facts = [
    { label: trade.side === "buy" ? "Paid" : "Got", value: formatMoney(usdcDollars(trade.usdc)) },
    {
      label: trade.side === "buy" ? "Shares bought" : "Shares sold",
      value: formatShareCount(shareCount(trade.shares))
    },
    { label: "Price", value: `${formatMoney(priceDollars(trade.price))} a share` },
    {
      label: "Against Chainlink",
      value: `${Math.abs(bpsPercent(trade.gapBps)).toFixed(2)}% ${trade.gapBps > 0 ? "worse" : "better"}`
    }
  ]

  return (
    <span className="mt-1 grid grid-cols-2 gap-3 rounded-[10px] px-3 py-2.5 surface-well sm:grid-cols-4">
      {facts.map((fact) => (
        <span key={fact.label} className="grid gap-0.5">
          <span className="text-caption text-g-500">{fact.label}</span>
          <span className="text-[13.5px] font-semibold text-ink tabular-nums">{fact.value}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * One item of activity, opening its details when pressed: what leads it, what happened with its status and time, who
 * sent it and its shares or address, a filled trade's facts, or calmly, what went wrong and that nothing moved.
 */
export function ActivityEntry(
  { item, names, agentName, onOpen }: Readonly<{
    item: ActivityItem
    names: ReadonlyMap<StockSymbol, string>
    agentName: (id: AgentId) => string | undefined
    onOpen: () => void
  }>
) {
  const status = activityStatus(item)
  const problem = activityProblem(item)
  const at = DateTime.toDateUtc(activityAt(item))
  const failed = status.tone === "negative"
  const trade = item._tag === "Trade" ? item.trade : null

  return (
    <li
      className={cn(
        "border-b border-g-100 last:border-b-0",
        failed && "bg-[linear-gradient(180deg,#fff8f6,#fff3ef)]"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3.5 px-5 py-4 text-left transition-colors hover:bg-g-50/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue"
      >
        <Lead item={item} />
        <span className="grid min-w-0 gap-1.5">
          <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <b className="text-[14.5px] font-semibold tracking-[-0.01em]">{activityTitle(item, names)}</b>
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
            </span>
            <time dateTime={at.toISOString()} className="text-label-sm text-g-500 tabular-nums">
              {formatTime(at, { timeZone: localTimeZone() })}
            </time>
          </span>

          {trade === null && failed ?
            null :
            (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm text-g-500">
                {trade === null ? null : (
                  <WhoChip
                    who={trade.agentId === null ?
                      { _tag: "source", source: "owner" } :
                      { _tag: "agent", id: trade.agentId, name: agentName(trade.agentId) }}
                  />
                )}
                {failed || trade?.status === "filled" ? null : <span className="min-w-0">{activityDetail(item)}</span>}
              </span>
            )}

          {problem === null ? null : (
            <span className="grid gap-0.5 text-label-sm">
              <span className="flex items-start gap-1.5 font-[550] text-loss">
                <Icon name="error" size={14} className="mt-px shrink-0" />
                {problem}
              </span>
              <span className="text-g-600">{activityDetail(item)}</span>
            </span>
          )}

          {trade?.status === "filled" ? <Facts trade={trade} /> : null}
        </span>
      </button>
    </li>
  )
}
