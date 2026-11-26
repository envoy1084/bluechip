import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Trade } from "@bluechip/domain/trading/Trade"
import { FairPriceCheck, OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { TradeReceipt } from "@bluechip/ui/bluechip/trade-receipt"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@bluechip/ui/components/sheet"
import { formatDate, formatMoney, formatShares } from "@bluechip/ui/lib/format"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { type RefObject, useRef, useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { activityAt, activityStatus, activityTitle, fairPriceText } from "../../../lib/activityText.ts"
import { priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { receiptWhen } from "../model/receipt.ts"

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1)

function Transaction({ txHash }: Readonly<{ txHash: string | null }>) {
  if (txHash === null) return <>Not on Base yet</>
  return (
    <a
      href={`https://basescan.org/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-blue hover:underline"
    >
      {txHash.slice(0, 6)}…{txHash.slice(-4)}
    </a>
  )
}

/**
 * Everything about one activity item: a filled trade's receipt, or its amounts, prices and the check against Chainlink,
 * status and transaction.
 */
export function ActivityDetails(
  { item, names, opener, onClose }: Readonly<{
    item: ActivityItem | undefined
    names: ReadonlyMap<StockSymbol, string>
    /** The row that opened it, where focus goes back on close. */
    opener: RefObject<HTMLElement | null>
    onClose: () => void
  }>
) {
  const title = useRef<HTMLHeadingElement>(null)
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())

  // A filled trade says who sent it and when under the title; its receipt below then holds only what moved.
  const filled = item?._tag === "Trade" && item.trade.status === "filled" ? item.trade : null
  const by = filled === null ?
    null :
    filled.agentId === null ?
    "You" :
    (AsyncResult.isSuccess(agents) ? agents.value.find((each) => each.id === filled.agentId)?.name : undefined) ??
      "An agent"

  return (
    <Sheet open={item !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent initialFocus={title} finalFocus={opener}>
        {item !== undefined && (
          <>
            <SheetHeader>
              <SheetTitle ref={title} tabIndex={-1} className="outline-none">{activityTitle(item, names)}</SheetTitle>
              <SheetDescription>
                {filled === null ?
                  formatDate(DateTime.toDateUtc(activityAt(item)), { timeZone: localTimeZone() }) :
                  `${by}, ${
                    lowerFirst(
                      receiptWhen(DateTime.toDateUtc(filled.settledAt ?? filled.createdAt), now, localTimeZone())
                    )
                  }`}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="grid content-start gap-4">
              {item._tag === "Trade" ? <TradeRows item={item} names={names} /> : (
                <OrderPreview>
                  <OrderPreviewRow label="Type">
                    {item.transfer.kind === "deposit" ? "Deposit" : "Withdrawal"}
                  </OrderPreviewRow>
                  <OrderPreviewRow label="Amount">
                    {item.transfer.asset === "USDC" ?
                      `${formatMoney(usdcDollars(item.transfer.amount))} USDC` :
                      `${formatShares(shareCount(item.transfer.amount))} ${item.transfer.asset}`}
                  </OrderPreviewRow>
                  <OrderPreviewRow label={item.transfer.kind === "deposit" ? "From" : "To"}>
                    <span className="font-mono">
                      {item.transfer.kind === "deposit" ? item.transfer.from : item.transfer.to}
                    </span>
                  </OrderPreviewRow>
                  <OrderPreviewRow label="Status">{activityStatus(item).label}</OrderPreviewRow>
                  <OrderPreviewRow label="Transaction">
                    <Transaction txHash={item.transfer.txHash} />
                  </OrderPreviewRow>
                </OrderPreview>
              )}
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** A filled trade, kept: what moved, then how its price compared with Chainlink's. */
function Receipt(
  { trade, names }: Readonly<{ trade: Trade; names: ReadonlyMap<StockSymbol, string> }>
) {
  return (
    <>
      <TradeReceipt
        side={trade.side}
        symbol={trade.symbol}
        name={names.get(trade.symbol) ?? trade.symbol}
        shares={shareCount(trade.shares)}
        price={priceDollars(trade.price)}
        total={usdcDollars(trade.usdc)}
        by=""
        when=""
        header={false}
        {...(trade.txHash === null ? {} : { txHash: trade.txHash })}
      />
      <OrderPreview>
        <PriceCheckRows trade={trade} />
      </OrderPreview>
    </>
  )
}

function PriceCheckRows({ trade }: Readonly<{ trade: Trade }>) {
  return (
    <>
      <OrderPreviewRow label="Chainlink price">
        {formatMoney(priceDollars(trade.reference))}
        {trade.referenceStatus === "paused" ? " (paused)" : ""}
      </OrderPreviewRow>
      <OrderPreviewRow label="Fair price check">
        <FairPriceCheck>{fairPriceText(trade.gapBps)}</FairPriceCheck>
      </OrderPreviewRow>
    </>
  )
}

function TradeRows(
  { item, names }: Readonly<{ item: Extract<ActivityItem, { _tag: "Trade" }>; names: ReadonlyMap<StockSymbol, string> }>
) {
  const { trade } = item
  const buying = trade.side === "buy"
  if (trade.status === "filled") return <Receipt trade={trade} names={names} />

  return (
    <OrderPreview>
      <OrderPreviewRow label={buying ? "Bought" : "Sold"}>
        <TickerChip symbol={trade.symbol} size="sm" />
        {names.get(trade.symbol) ?? trade.symbol}
      </OrderPreviewRow>
      <OrderPreviewRow label={buying ? "You paid" : "You got"}>
        {formatMoney(usdcDollars(trade.usdc))} (quoted)
      </OrderPreviewRow>
      <OrderPreviewRow label="Shares">{formatShares(shareCount(trade.shares))}</OrderPreviewRow>
      <OrderPreviewRow label="Price">{formatMoney(priceDollars(trade.price))} a share</OrderPreviewRow>
      <PriceCheckRows trade={trade} />
      <OrderPreviewRow label="Status">{activityStatus(item).label}</OrderPreviewRow>
      <OrderPreviewRow label="Transaction">
        <Transaction txHash={trade.txHash} />
      </OrderPreviewRow>
    </OrderPreview>
  )
}
