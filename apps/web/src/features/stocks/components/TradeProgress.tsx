import type { Trade } from "@bluechip/domain/trading/Trade"
import { OrderPreview, OrderPreviewRow } from "@bluechip/ui/bluechip/order-preview"
import { Outcome, OutcomeLink } from "@bluechip/ui/bluechip/outcome"
import { Button } from "@bluechip/ui/components/button"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import { priceDollars, shareCount, usdcDollars } from "../../../lib/amounts.ts"
import { describeTrade, tradeOutcome } from "../../../lib/tradeOutcome.ts"

/**
 * A sent trade, in one place from the send to its end: a short wait while Base takes it, then the fill (shares, price,
 * total) and the way to the next one, or that nothing moved and Try again.
 */
export function TradeProgress(
  { trade, name, onDone }: Readonly<{ trade: Trade; name: string; onDone: () => void }>
) {
  const buying = trade.side === "buy"
  const text = tradeOutcome(trade.status, trade.side, describeTrade(trade, name))

  return (
    <Outcome
      tone={text.tone}
      title={text.title}
      description={text.description}
      actions={trade.status === "filled" || trade.status === "failed" ?
        (
          <Button variant={trade.status === "failed" ? "primary" : "secondary"} className="w-full" onClick={onDone}>
            {trade.status === "failed" ? "Try again" : buying ? `Buy more ${name}` : "Trade again"}
          </Button>
        ) :
        undefined}
    >
      {trade.status === "filled" ?
        (
          <OrderPreview>
            <OrderPreviewRow label={buying ? "Shares bought" : "Shares sold"}>
              {formatShareCount(shareCount(trade.shares))}
            </OrderPreviewRow>
            <OrderPreviewRow label="Price">{formatMoney(priceDollars(trade.price))} a share</OrderPreviewRow>
            <OrderPreviewRow label={buying ? "You paid" : "You got"}>
              {formatMoney(usdcDollars(trade.usdc))}
            </OrderPreviewRow>
          </OrderPreview>
        ) :
        undefined}
      {trade.txHash === null ?
        undefined :
        <OutcomeLink href={`https://basescan.org/tx/${trade.txHash}`}>View on BaseScan</OutcomeLink>}
    </Outcome>
  )
}
