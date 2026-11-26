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
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { activityAt, describeActivity } from "../../../components/ActivityLine.tsx"
import { bpsPercent, priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { localTimeZone } from "../../../lib/localTime.ts"
import { receiptWhen } from "../model/receipt.ts"

const STATUS = {
  sending: "Sending",
  confirming: "Confirming on Base",
  filled: "Filled",
  pending: "Sending",
  confirmed: "Sent",
  failed: "Didn't go through"
} as const

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
  { item, names, onClose }: Readonly<{
    item: ActivityItem | undefined
    names: ReadonlyMap<StockSymbol, string>
    onClose: () => void
  }>
) {
  return (
    <Sheet open={item !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {item !== undefined && (
          <>
            <SheetHeader>
              <SheetTitle>{describeActivity(item, names).title}</SheetTitle>
              <SheetDescription>
                {formatDate(DateTime.toDateUtc(activityAt(item)), { timeZone: localTimeZone() })}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="grid content-start gap-4">
              {item._tag === "Trade" ? <TradeRows item={item} names={names} /> : (
                <OrderPreview>
                  <OrderPreviewRow label="Type">Withdrawal</OrderPreviewRow>
                  <OrderPreviewRow label="Amount">
                    {formatMoney(usdcDollars(item.transfer.amount))} USDC
                  </OrderPreviewRow>
                  <OrderPreviewRow label="To">
                    <span className="font-mono">{item.transfer.to}</span>
                  </OrderPreviewRow>
                  <OrderPreviewRow label="Status">{STATUS[item.transfer.status]}</OrderPreviewRow>
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

/** A filled trade, kept: who sent it and when, what moved, then how its price compared with Chainlink's. */
function Receipt(
  { trade, names }: Readonly<{ trade: Trade; names: ReadonlyMap<StockSymbol, string> }>
) {
  const agents = useAtomValue(agentsAtom)
  const [now] = useState(() => new Date())
  const agent = AsyncResult.isSuccess(agents) ? agents.value.find((each) => each.id === trade.agentId) : undefined
  const by = trade.agentId === null ? "You" : agent?.name ?? "An agent"

  return (
    <>
      <TradeReceipt
        side={trade.side}
        symbol={trade.symbol}
        name={names.get(trade.symbol) ?? trade.symbol}
        shares={shareCount(trade.shares)}
        price={priceDollars(trade.price)}
        total={usdcDollars(trade.usdc)}
        by={by}
        when={receiptWhen(DateTime.toDateUtc(trade.settledAt ?? trade.createdAt), now, localTimeZone())}
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
        <FairPriceCheck>
          {Math.abs(bpsPercent(trade.gapBps)).toFixed(2)}% {trade.gapBps > 0 ? "worse" : "better"} than Chainlink
        </FairPriceCheck>
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
        {formatMoney(usdcDollars(trade.usdc))} USDC (quoted)
      </OrderPreviewRow>
      <OrderPreviewRow label="Shares">{formatShares(shareCount(trade.shares))}</OrderPreviewRow>
      <OrderPreviewRow label="Price">{formatMoney(priceDollars(trade.price))} a share</OrderPreviewRow>
      <PriceCheckRows trade={trade} />
      <OrderPreviewRow label="Status">{STATUS[trade.status]}</OrderPreviewRow>
      <OrderPreviewRow label="Transaction">
        <Transaction txHash={trade.txHash} />
      </OrderPreviewRow>
    </OrderPreview>
  )
}
