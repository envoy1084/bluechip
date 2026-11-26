import type { ComponentProps, ReactNode } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { TickerChip } from "./ticker-chip.tsx"

/** The lines of an order, label left and value right, on a recessed panel. */
export function OrderPreview({ className, ...props }: ComponentProps<"dl">) {
  return (
    <dl
      data-slot="order-preview"
      className={cn("rounded-[12px] px-3 py-0.5 text-left surface-well", className)}
      {...props}
    />
  )
}

export interface OrderPreviewRowProps extends Omit<ComponentProps<"div">, "children"> {
  readonly label: ReactNode
  readonly children: ReactNode
}

export function OrderPreviewRow({ label, children, className, ...props }: OrderPreviewRowProps) {
  return (
    <div
      data-slot="order-preview-row"
      className={cn(
        "flex items-center justify-between gap-2.5 border-b border-ink/6 py-[9px] text-[13.5px] last:border-b-0",
        className
      )}
      {...props}
    >
      <dt className="whitespace-nowrap text-g-500">{label}</dt>
      <dd className="inline-flex items-center gap-1.5 text-right font-semibold tabular-nums">{children}</dd>
    </div>
  )
}

/** The fair price check, always shown: it passes or it says by how much it missed. */
export function FairPriceCheck(
  { passed = true, children }: { readonly passed?: boolean; readonly children?: ReactNode }
) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", passed ? "text-gain" : "text-loss")}>
      <Icon name={passed ? "check-circle" : "error"} size={14} />
      {children ?? (passed ? "Within 1% of the market" : "More than 1% off the market")}
    </span>
  )
}

export interface TradeOrder {
  readonly side: "buy" | "sell"
  readonly symbol: string
  readonly name: string
  /** Dollars to spend or receive. */
  readonly amount: number
  /** Price of one share now. */
  readonly price: number
  /** Where the trade leaves you against your limits: "Nvidia is 29% of your money". */
  readonly after?: ReactNode
  readonly fee: number
}

/** Exactly what a buy or sell will do before it happens: amount, price, shares, the fair price check and the fee. */
export function TradeOrderPreview({ order, className }: { readonly order: TradeOrder; readonly className?: string }) {
  return (
    <OrderPreview className={className}>
      <OrderPreviewRow label={order.side === "buy" ? "Buy" : "Sell"}>
        <TickerChip symbol={order.symbol} size="sm" />
        {formatMoney(order.amount)} of {order.name}
      </OrderPreviewRow>
      <OrderPreviewRow label="Price">{formatMoney(order.price)} a share</OrderPreviewRow>
      <OrderPreviewRow label={order.side === "buy" ? "You get about" : "You sell about"}>
        {(order.amount / order.price).toFixed(3)} shares
      </OrderPreviewRow>
      <OrderPreviewRow label="Fair price check">
        <FairPriceCheck />
      </OrderPreviewRow>
      {order.after !== undefined && <OrderPreviewRow label="After this trade">{order.after}</OrderPreviewRow>}
      <OrderPreviewRow label="Fee">{formatMoney(order.fee)}</OrderPreviewRow>
    </OrderPreview>
  )
}
