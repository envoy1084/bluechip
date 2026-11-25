import type { Quote, Stock } from "@bluechip/domain/market/Market"
import { FairPriceCheck, OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatMoney, formatShares, formatTokenAmount } from "@bluechip/ui/lib/format"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import { bpsPercent, priceDollars, shareCount } from "../../../lib/amounts.ts"

const usdc = (units: bigint) => (
  <>
    <UsdcLogo size={14} />
    {formatTokenAmount(units, "USDC", { decimals: 6 })}
  </>
)
const shares = (units: bigint) => `${formatShares(shareCount(units))} shares`

// The server's fair-price limits: 1% off Chainlink, 0.5% while prices are paused.
const LIVE_LIMIT_BPS = 100
const PAUSED_LIMIT_BPS = 50

/**
 * How far the pool's price is from Chainlink's, from the trader's side (the quote's gap is positive when worse for
 * them). While prices are paused, Chainlink's is the last one before the pause, and the check says so.
 */
function FairPrice({ quote }: Readonly<{ quote: Quote }>) {
  const paused = quote.reference.status === "paused"

  if (quote.gapBps <= (paused ? PAUSED_LIMIT_BPS : LIVE_LIMIT_BPS)) {
    return (
      <FairPriceCheck>
        {paused ? "Within 0.5% of Chainlink's last price before the pause" : "Within 1% of Chainlink's price"}
      </FairPriceCheck>
    )
  }
  return (
    <FairPriceCheck passed={false}>
      {bpsPercent(quote.gapBps).toFixed(2)}% worse than Chainlink's price
      {paused ? " (paused)" : ""}
    </FairPriceCheck>
  )
}

/** What a quoted trade does: the stock, what you pay and get, at what price, the fair price check and the least out. */
export function QuoteSummary({ stock, quote }: Readonly<{ stock: Stock; quote: Quote }>) {
  const buying = quote.side === "buy"
  return (
    <OrderPreview>
      <OrderPreviewRow label={buying ? "Buy" : "Sell"}>
        <TickerChip symbol={stock.symbol} size="sm" />
        {stock.name}
      </OrderPreviewRow>
      <OrderPreviewRow label="You pay">{buying ? usdc(quote.usdc) : shares(quote.shares)}</OrderPreviewRow>
      <OrderPreviewRow label="Price">{formatMoney(priceDollars(quote.price))} a share</OrderPreviewRow>
      <OrderPreviewRow label="You get about">{buying ? shares(quote.shares) : usdc(quote.usdc)}</OrderPreviewRow>
      <OrderPreviewRow label="Fair price check">
        <FairPrice quote={quote} />
      </OrderPreviewRow>
      <OrderPreviewRow label="At least, after 0.5% slippage">
        {buying ? shares(quote.minimumOut) : usdc(quote.minimumOut)}
      </OrderPreviewRow>
    </OrderPreview>
  )
}

export function QuoteSummarySkeleton() {
  return (
    <div aria-busy className="grid gap-3 rounded-[12px] px-3.5 py-3.5 surface-well">
      {["a", "b", "c", "d", "e", "f"].map((id) => <SkeletonBlock key={id} className="h-4 w-full" />)}
    </div>
  )
}
