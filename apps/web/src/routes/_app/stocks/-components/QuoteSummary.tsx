import type { Quote } from "@bluechip/domain/market/Market"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatMoney, formatShares } from "@bluechip/ui/lib/format"
import { bpsPercent, priceDollars, shareCount, usdcDollars } from "../../../../market/amounts.ts"

const usdc = (units: bigint) => `${formatMoney(usdcDollars(units))} USDC`
const shares = (units: bigint) => `${formatShares(shareCount(units))} shares`

/** How far the pool's price is from the Chainlink one, from the trader's side: buying above or selling below is worse. */
const gapSentence = (quote: Quote) => {
  const percent = Math.abs(bpsPercent(quote.gapBps)).toFixed(2)
  if (quote.gapBps === 0) return "In line with the reference price"
  const above = (quote.gapBps > 0) === (quote.side === "buy")
  return `${percent}% ${above ? "above" : "below"} the reference price`
}

// Over 1% off the reference is what the fair price check would flag later, so it reads as a warning here too.
const WARN_GAP_BPS = 100

/** What a quoted trade does: what you pay, what you get, at what price, and the least you would receive. */
export function QuoteSummary({ quote }: Readonly<{ quote: Quote }>) {
  const buying = quote.side === "buy"
  return (
    <OrderPreview>
      <OrderPreviewRow label="You pay">{buying ? usdc(quote.usdc) : shares(quote.shares)}</OrderPreviewRow>
      <OrderPreviewRow label="You get about">{buying ? shares(quote.shares) : usdc(quote.usdc)}</OrderPreviewRow>
      <OrderPreviewRow label="Price per share">{formatMoney(priceDollars(quote.price))}</OrderPreviewRow>
      <OrderPreviewRow label="Chainlink price">
        <span className={Math.abs(quote.gapBps) > WARN_GAP_BPS && quote.gapBps > 0 ? "text-warn" : undefined}>
          {gapSentence(quote)}
        </span>
      </OrderPreviewRow>
      <OrderPreviewRow label="At least, 0.5% slippage">
        {buying ? shares(quote.minimumOut) : usdc(quote.minimumOut)}
      </OrderPreviewRow>
    </OrderPreview>
  )
}

export function QuoteSummarySkeleton() {
  return (
    <div aria-busy className="grid gap-3 rounded-[12px] px-3.5 py-3.5 surface-well">
      {["a", "b", "c", "d", "e"].map((id) => <SkeletonBlock key={id} className="h-4 w-full" />)}
    </div>
  )
}
