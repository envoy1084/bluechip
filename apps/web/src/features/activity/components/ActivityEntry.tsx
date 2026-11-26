import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Trade } from "@bluechip/domain/trading/Trade"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney, formatShareCount, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { IllustrationTile } from "../../../components/IllustrationTile.tsx"
import { TradeRow } from "../../../components/TradeRow.tsx"
import { WhoChip } from "../../../components/WhoChip.tsx"
import {
  activityAt,
  activityDetail,
  activityProblem,
  activityStatus,
  activityTitle,
  fairPriceText
} from "../../../lib/activityText.ts"
import { priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
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

/** What a filled trade moved, from its receipt, and how its price compared with Chainlink's, in its details' words. */
function Facts({ trade }: Readonly<{ trade: Trade }>) {
  const facts = [
    { label: trade.side === "buy" ? "You paid" : "You got", value: formatMoney(usdcDollars(trade.usdc)) },
    {
      label: trade.side === "buy" ? "Shares bought" : "Shares sold",
      value: formatShareCount(shareCount(trade.shares))
    },
    { label: "Price", value: `${formatMoney(priceDollars(trade.price))} a share` },
    { label: "Fair price check", value: fairPriceText(trade.gapBps) }
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
 * One item of activity on the shared trade row, opening its details when pressed (`onOpen`, given the row, where
 * focus returns): what leads it, what happened with its status and time, who sent it and its shares or address, a
 * filled trade's facts, or calmly, what went wrong and that nothing moved.
 */
export function ActivityEntry(
  { item, names, agentName, onOpen }: Readonly<{
    item: ActivityItem
    names: ReadonlyMap<StockSymbol, string>
    agentName: (id: AgentId) => string | undefined
    onOpen: (row: HTMLElement) => void
  }>
) {
  const status = activityStatus(item)
  const problem = activityProblem(item)
  const at = DateTime.toDateUtc(activityAt(item))
  const failed = status.tone === "negative"
  const trade = item._tag === "Trade" ? item.trade : null

  return (
    <TradeRow
      lead={<Lead item={item} />}
      title={activityTitle(item, names)}
      status={status}
      time={{ at, text: formatTime(at, { timeZone: localTimeZone() }) }}
      tone={failed ? "failed" : "plain"}
      onOpen={onOpen}
    >
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
    </TradeRow>
  )
}
