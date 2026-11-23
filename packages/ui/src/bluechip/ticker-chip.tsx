import { Toggle as BaseToggle } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney } from "../lib/format.ts"
import { haptic } from "../lib/haptics.ts"
import { tickerTone } from "../lib/tickers.ts"
import { PriceChange } from "./price-change.tsx"

/** The symbol cash is shown with. Its chip is the one neutral chip. */
export const CASH_SYMBOL = "USDC"

export const tickerChipVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-pixel font-extrabold tracking-[.05em] whitespace-nowrap",
  {
    variants: {
      tone: {
        blue:
          "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_1px_2px_rgba(20,50,160,.15)]",
        yellow:
          "bg-[linear-gradient(180deg,#ffdc5c,#ffd12f)] text-[#3a2c00] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_1px_2px_rgba(120,90,0,.15)]",
        green:
          "bg-[linear-gradient(180deg,#7ad61a,#66c800)] text-[#0c2a00] shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_1px_2px_rgba(40,90,0,.15)]",
        pink:
          "bg-[linear-gradient(180deg,#ffbdd9,#fea8cd)] text-[#4a0f2a] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_1px_2px_rgba(120,30,70,.12)]",
        ink:
          "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.18)]",
        cerulean:
          "bg-[linear-gradient(180deg,#62a2ff,#3c8aff)] text-[#00163d] shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_1px_2px_rgba(0,60,160,.15)]",
        lilac:
          "bg-[linear-gradient(180deg,#dcaefe,#cd99fd)] text-[#2c0a4d] shadow-[inset_0_1px_0_rgba(255,255,255,.5),0_1px_2px_rgba(80,30,120,.12)]",
        tan:
          "bg-[linear-gradient(180deg,#cbb995,#b8a581)] text-[#2a2111] shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_1px_2px_rgba(80,60,20,.12)]",
        cash:
          "bg-[linear-gradient(180deg,#fff,#eef0f3)] text-g-700 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.1),0_1px_2px_rgba(10,11,13,.05)]",
        unavailable:
          "bg-[repeating-linear-gradient(135deg,#f4f5f7_0_4px,#eceef2_4px_8px)] text-g-500 line-through decoration-ink/35 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
      },
      size: {
        sm: "rounded-[5px] px-1.5 pt-[3px] pb-0.5 text-caption-sm",
        md: "rounded-[7px] px-[9px] pt-[5px] pb-1 text-label",
        lg: "rounded-[9px] px-[11px] pt-[7px] pb-1.5 text-body-lg"
      }
    },
    defaultVariants: { tone: "blue", size: "md" }
  }
)

export interface TickerChipProps
  extends Omit<ComponentProps<"span">, "children">, Pick<VariantProps<typeof tickerChipVariants>, "size">
{
  /** The market symbol ("NVDA"), or `USDC` for cash. */
  readonly symbol: string
  /** A stock bluechip doesn't trade: struck through and grey. */
  readonly unavailable?: boolean
  /** Shows the price after the chip. */
  readonly price?: number
  /** Today's change in percent, shown after the price. */
  readonly change?: number
}

const toneOf = (symbol: string, unavailable: boolean) =>
  unavailable ? "unavailable" : symbol === CASH_SYMBOL ? "cash" : tickerTone(symbol)

/**
 * A stock's symbol in Doto on its own color. The color is fixed per stock everywhere, so people learn it; cash is
 * the one neutral chip. Sizes are 11, 13 and 16 px.
 */
export function TickerChip(
  { symbol, size, unavailable = false, price, change, className, ...props }: TickerChipProps
) {
  const chip = (
    <span
      data-slot="ticker-chip"
      data-symbol={symbol}
      className={cn(
        tickerChipVariants({ tone: toneOf(symbol, unavailable), size }),
        price === undefined && className
      )}
      {...(unavailable ? { title: "Not available on bluechip" } : {})}
      {...(price === undefined ? props : {})}
    >
      {symbol}
    </span>
  )
  if (price === undefined) return chip
  return (
    <span
      data-slot="ticker-chip-price"
      className={cn("inline-flex items-center gap-2.5 whitespace-nowrap", className)}
      {...props}
    >
      {chip}
      <span className="text-[13.5px] font-[550] tabular-nums">{formatMoney(price)}</span>
      {change !== undefined && <PriceChange value={change} size="sm" />}
    </span>
  )
}

export interface TickerToggleProps extends Omit<ComponentProps<typeof BaseToggle>, "children"> {
  readonly symbol: string
  /** The company name shown after the chip. */
  readonly name: string
}

/** A selectable stock (pick the stocks an agent can trade). Space or Enter toggles it; it reads as pressed. */
export function TickerToggle({ symbol, name, className, onPressedChange, ...props }: TickerToggleProps) {
  return (
    <BaseToggle
      data-slot="ticker-toggle"
      className={cn(
        "group/tt inline-flex cursor-pointer items-center gap-2 rounded-[10px] py-1 pr-2.5 pl-1 text-label font-medium text-g-700",
        "bg-[linear-gradient(180deg,#fff,#f8f9fa)] shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.09),0_1px_1px_rgba(10,11,13,.03)]",
        "transition-[box-shadow,background,scale] duration-fast ease-brand hover:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.14),0_1px_3px_rgba(10,11,13,.05)] active:scale-98",
        "data-pressed:bg-[linear-gradient(180deg,#fff,#f5f7ff)] data-pressed:text-ink data-pressed:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(42,91,255,.45),0_1px_2px_rgba(42,91,255,.07)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
        "data-disabled:cursor-not-allowed data-disabled:opacity-45",
        className
      )}
      onPressedChange={(pressed, details) => {
        haptic("select")
        onPressedChange?.(pressed, details)
      }}
      {...props}
    >
      <TickerChip
        symbol={symbol}
        className="opacity-50 grayscale transition-[filter,opacity] duration-base ease-brand group-data-pressed/tt:opacity-100 group-data-pressed/tt:grayscale-0"
      />
      <span>{name}</span>
      <Icon
        name="check"
        size={14}
        className="w-0 text-blue opacity-0 transition-[width,opacity] duration-base ease-brand group-data-pressed/tt:w-3.5 group-data-pressed/tt:opacity-100"
      />
    </BaseToggle>
  )
}
