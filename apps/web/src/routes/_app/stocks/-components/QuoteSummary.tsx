import type { Quote, Stock } from "@bluechip/domain/market/Market"
import { FairPriceCheck, OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { formatMoney, formatShares, formatTokenAmount } from "@bluechip/ui/lib/format"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import { bpsPercent, priceDollars, shareCount } from "../../../../market/amounts.ts"

const usdc = (units: bigint) => (
  <>
    <UsdcLogo size={14} />
    {formatTokenAmount(units, "USDC", { decimals: 6 })}
  </>
)
const shares = (units: bigint) => `${formatShares(shareCount(units))} shares`

// More than 1% off the Chainlink reference is what the fair price check flags.
const FAIR_GAP_BPS = 100

/** How far the pool's price is from the Chainlink one, from the trader's side: buying above or selling below is worse. */
function FairPrice({ quote }: Readonly<{ quote: Quote }>) {
  const worse = (quote.gapBps > 0) === (quote.side === "buy")
  if (Math.abs(quote.gapBps) <= FAIR_GAP_BPS || !worse) return <FairPriceCheck />
  return (
    <FairPriceCheck passed={false}>
      {Math.abs(bpsPercent(quote.gapBps)).toFixed(2)}% {quote.side === "buy" ? "above" : "below"} the market
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
