import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { FairPriceCheck, OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@bluechip/ui/components/sheet"
import { formatDate, formatMoney, formatShares } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { activityAt, describeActivity } from "../../../../activity/ActivityLine.tsx"
import { bpsPercent, priceDollars, shareCount, usdcDollars } from "../../../../market/amounts.ts"

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

/** Everything about one activity item: amounts, prices and the check against Chainlink, status and transaction. */
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
              <SheetDescription>{formatDate(DateTime.toDateUtc(activityAt(item)))}</SheetDescription>
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

function TradeRows(
  { item, names }: Readonly<{ item: Extract<ActivityItem, { _tag: "Trade" }>; names: ReadonlyMap<StockSymbol, string> }>
) {
  const { trade } = item
  const buying = trade.side === "buy"
  const settled = trade.status === "filled"

  return (
    <OrderPreview>
      <OrderPreviewRow label={buying ? "Bought" : "Sold"}>
        <TickerChip symbol={trade.symbol} size="sm" />
        {names.get(trade.symbol) ?? trade.symbol}
      </OrderPreviewRow>
      <OrderPreviewRow label={buying ? "You paid" : "You got"}>
        {formatMoney(usdcDollars(trade.usdc))} USDC{settled ? "" : " (quoted)"}
      </OrderPreviewRow>
      <OrderPreviewRow label="Shares">{formatShares(shareCount(trade.shares))}</OrderPreviewRow>
      <OrderPreviewRow label="Price">{formatMoney(priceDollars(trade.price))} a share</OrderPreviewRow>
      <OrderPreviewRow label="Chainlink price">
        {formatMoney(priceDollars(trade.reference))}
        {trade.referenceStatus === "paused" ? " (paused)" : ""}
      </OrderPreviewRow>
      <OrderPreviewRow label="Fair price check">
        <FairPriceCheck>
          {Math.abs(bpsPercent(trade.gapBps)).toFixed(2)}% {trade.gapBps > 0 ? "worse" : "better"} than Chainlink
        </FairPriceCheck>
      </OrderPreviewRow>
      <OrderPreviewRow label="Status">{STATUS[trade.status]}</OrderPreviewRow>
      <OrderPreviewRow label="Transaction">
        <Transaction txHash={trade.txHash} />
      </OrderPreviewRow>
    </OrderPreview>
  )
}
