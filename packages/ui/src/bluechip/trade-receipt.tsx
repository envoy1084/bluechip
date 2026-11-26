import { cn } from "../lib/cn.ts"
import { formatMoney, formatShareCount } from "../lib/format.ts"
import { OrderPreview, OrderPreviewRow } from "./order-preview.tsx"
import { OutcomeLink } from "./outcome.tsx"
import { TickerChip } from "./ticker-chip.tsx"

export interface TradeReceiptProps {
  readonly side: "buy" | "sell"
  readonly symbol: string
  readonly name: string
  readonly shares: number
  /** The price it filled at, for one share. */
  readonly price: number
  /** What was paid or received, in dollars. */
  readonly total: number
  /** Who sent it: "You", or the agent's name. */
  readonly by: string
  /** When it filled: "Today at 09:41". */
  readonly when: string
  /** The transaction on Base, for the BaseScan link. */
  readonly txHash?: string
  readonly className?: string
}

/**
 * A filled trade, kept: what moved, at what price, who sent it and when, with the transaction on Base. For an
 * activity's detail; the moment a trade fills is an `Outcome`.
 */
export function TradeReceipt(
  { side, symbol, name, shares, price, total, by, when, txHash, className }: TradeReceiptProps
) {
  const buying = side === "buy"

  return (
    <section
      data-slot="trade-receipt"
      aria-label={`${buying ? "Bought" : "Sold"} ${name}`}
      className={cn("grid gap-3.5 rounded-lg bg-white p-5 shadow-e2", className)}
    >
      <header className="flex items-center gap-2.5">
        <TickerChip symbol={symbol} />
        <span className="grid">
          <b className="text-[16px] font-semibold">
            {buying ? "Bought" : "Sold"} {formatMoney(total)} of {name}
          </b>
          <span className="text-label-sm text-g-500">
            {`${by}, ${when.charAt(0).toLowerCase()}${when.slice(1)}`}
          </span>
        </span>
      </header>
      <OrderPreview>
        <OrderPreviewRow label={buying ? "Shares bought" : "Shares sold"}>{formatShareCount(shares)}</OrderPreviewRow>
        <OrderPreviewRow label="Price">{formatMoney(price)} a share</OrderPreviewRow>
        <OrderPreviewRow label={buying ? "You paid" : "You got"}>{formatMoney(total)}</OrderPreviewRow>
      </OrderPreview>
      {txHash === undefined
        ? null
        : <OutcomeLink href={`https://basescan.org/tx/${txHash}`}>View on BaseScan</OutcomeLink>}
    </section>
  )
}
