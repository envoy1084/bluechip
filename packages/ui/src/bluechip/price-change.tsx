import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon, type IconName } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatChange, formatMoney, formatPercent } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { usePriceFlash } from "../motion/use-price-flash.ts"

/** Which way a value moved. Anything that rounds to 0.00 is flat. */
export type PriceDirection = "up" | "down" | "flat"

/** The direction of a change, after rounding to the two decimals people see. */
export const priceDirection = (change: number): PriceDirection => {
  // The same rounding as the label, so "−0.01%" is never shown as flat.
  const shown = Number(change.toFixed(2))
  return shown > 0 ? "up" : shown < 0 ? "down" : "flat"
}

const ARROW: Readonly<Record<PriceDirection, IconName>> = {
  up: "arrow-up-right",
  down: "arrow-down-right",
  flat: "minus"
}

export const priceChangeVariants = cva(
  "inline-flex items-center gap-0.5 font-semibold whitespace-nowrap tabular-nums",
  {
    variants: {
      direction: { up: "text-gain", down: "text-loss", flat: "text-g-500" },
      size: { sm: "text-caption", md: "text-label-sm", lg: "text-[15px]" }
    },
    defaultVariants: { direction: "flat", size: "md" }
  }
)

export interface PriceChangeProps
  extends Omit<ComponentProps<"span">, "children">, Pick<VariantProps<typeof priceChangeVariants>, "size">
{
  /** The change in percent (1.82 means 1.82%). */
  readonly value: number
  /** The change in dollars, shown before the percent: "+$220.40 (+1.83%)". */
  readonly amount?: number
}

/**
 * A change, never by color alone: an arrow, a sign and the tone. Up is Gain, down is Loss, flat is grey with a dash.
 * The numbers roll when they change.
 */
export function PriceChange({ value, amount, size, className, ...props }: PriceChangeProps) {
  const direction = priceDirection(value)
  return (
    <span
      data-slot="price-change"
      data-direction={direction}
      className={cn(priceChangeVariants({ direction, size }), className)}
      {...props}
    >
      <Icon name={ARROW[direction]} size={size === "lg" ? 16 : 14} />
      {amount === undefined ? <NumberRoll value={value} format={formatPercent} /> : (
        <>
          <NumberRoll value={amount} format={formatChange} />
          {/* The parentheses hug the percent: one run of text, outside the row's gap. */}
          <span className="inline-flex items-center whitespace-pre">
            {" ("}
            <NumberRoll value={value} format={formatPercent} />
            {")"}
          </span>
        </>
      )}
    </span>
  )
}

export const priceVariants = cva("inline-flex flex-wrap items-baseline", {
  variants: {
    size: {
      sm: "gap-2 [&_[data-slot=price-value]]:text-[13.5px] [&_[data-slot=price-value]]:font-[550]",
      md: "gap-2 [&_[data-slot=price-value]]:text-body-lg",
      lg: "gap-2 [&_[data-slot=price-value]]:text-title-1",
      xl:
        "gap-3 [&_[data-slot=price-value]]:text-[44px] [&_[data-slot=price-value]]:leading-[1.05] [&_[data-slot=price-value]]:tracking-[-0.04em]"
    },
    layout: { inline: "", stacked: "flex-col items-end gap-0" }
  },
  defaultVariants: { size: "md", layout: "inline" }
})

export interface PriceProps extends Omit<ComponentProps<"span">, "children">, VariantProps<typeof priceVariants> {
  readonly price: number
  /** Change since the last close, in percent. Leave it out when it isn't known; nothing is shown then. */
  readonly change?: number
  /** Change in dollars, shown with the percent. */
  readonly changeAmount?: number
  /** Tint the price briefly in the direction it moved when it changes. Defaults to true. */
  readonly flash?: boolean
}

/** A price in tabular figures with its change. A new price rolls in and flashes Gain or Loss for a moment. */
export function Price(
  { price, change, changeAmount, flash = true, size, layout, className, ...props }: PriceProps
) {
  const flashClass = usePriceFlash(price)
  return (
    <span data-slot="price" className={cn(priceVariants({ size, layout }), className)} {...props}>
      <span
        data-slot="price-value"
        className={cn(
          "-mx-[3px] rounded-xs px-[3px] font-semibold tracking-[-0.01em] tabular-nums",
          flash && flashClass
        )}
      >
        <NumberRoll value={price} format={formatMoney} />
      </span>
      {change === undefined ? null : (
        <PriceChange
          value={change}
          size={size === "xl" ? "lg" : size === "sm" ? "sm" : "md"}
          {...(changeAmount === undefined ? {} : { amount: changeAmount })}
        />
      )}
    </span>
  )
}
