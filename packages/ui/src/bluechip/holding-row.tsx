import { useRender } from "@base-ui/react/use-render"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMoney, formatShareCount } from "../lib/format.ts"
import { NumberRoll } from "../motion/number-roll.tsx"
import { AllocationBar, capState } from "./allocation-bar.tsx"
import { PriceChange } from "./price-change.tsx"
import { CASH_SYMBOL, TickerChip } from "./ticker-chip.tsx"

const rowClassName = cn(
  "grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-g-100 bg-white py-3 pr-3.5 pl-4 text-left last:border-b-0 sm:grid-cols-[60px_minmax(0,1fr)_auto_16px]",
  "cursor-pointer transition-colors duration-fast ease-brand hover:bg-[#fafbfc] active:bg-g-50",
  "focus-visible:rounded-[4px] focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
)

export interface HoldingRowProps extends Omit<useRender.ComponentProps<"button">, "children"> {
  readonly symbol: string
  readonly name: string
  readonly shares: number
  /** What it's worth now, in dollars. */
  readonly value: number
  /** Share of your money, 0 to 100. */
  readonly weight: number
  /** Your max in one stock, in percent; leave it out while no limit applies. */
  readonly cap?: number
  /** Today's change in percent; `null` while it isn't known. */
  readonly change: number | null
}

/**
 * One stock you own: shares, value, today's change (left out while it isn't known) and how close it is to your max.
 * The row is one button, or a link when the router's link is its `render`, so it opens in a new tab like any link.
 */
export function HoldingRow(
  { symbol, name, shares, value, weight, cap, change, className, render, ...props }: HoldingRowProps
) {
  const state = cap === undefined ? "under" : capState(weight, cap)
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      ...(render === undefined ? { type: "button" as const } : {}),
      ...props,
      "data-slot": "holding-row",
      "data-state": state,
      className: cn(rowClassName, state === "over" && "bg-[linear-gradient(90deg,#fff8f6,#fff_60%)]", className),
      children: (
        <HoldingRowContent
          symbol={symbol}
          name={name}
          shares={shares}
          value={value}
          weight={weight}
          cap={cap}
          change={change}
          state={state}
        />
      )
    }
  })
}

function HoldingRowContent(
  { symbol, name, shares, value, weight, cap, change, state }:
    & Pick<HoldingRowProps, "symbol" | "name" | "shares" | "value" | "weight" | "change">
    & { readonly cap: number | undefined; readonly state: ReturnType<typeof capState> }
) {
  return (
    <>
      <TickerChip symbol={symbol} />
      <span className="grid min-w-0 gap-px leading-[1.35]">
        <span className="flex flex-wrap items-center gap-1.5 text-body-sm font-[550]">
          {name}
          {state === "over" && <MiniBadge tone="loss">Over your max</MiniBadge>}
          {state === "at" && <MiniBadge tone="warn">At max</MiniBadge>}
        </span>
        <span className="text-label-sm text-g-500 tabular-nums">
          {formatShareCount(shares)}, {weight.toFixed(1)}%{cap === undefined ? " of your money" : ` of ${cap}% max`}
        </span>
        {cap !== undefined && <AllocationBar weight={weight} cap={cap} label={name} className="mt-1.5 max-w-[220px]" />}
      </span>
      <span className="grid justify-items-end gap-px">
        <NumberRoll value={value} format={formatMoney} className="text-body-sm font-semibold" />
        {change === null
          ? <span className="text-label-sm text-g-400">No change yet</span>
          : <PriceChange value={change} />}
      </span>
      <Icon name="chevron-right" size={16} className="hidden text-g-300 sm:block" />
    </>
  )
}

export interface CashHoldingRowProps extends Omit<useRender.ComponentProps<"button">, "children"> {
  readonly value: number
  readonly weight: number
  /** The share you always keep as cash, in percent; leave it out while no agent keeps a reserve. */
  readonly reserve?: number
}

/** Your cash, always the last holding. Its bar marks the reserve your agents keep. A button, or `render`'s element. */
export function CashHoldingRow({ value, weight, reserve, className, render, ...props }: CashHoldingRowProps) {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      ...(render === undefined ? { type: "button" as const } : {}),
      ...props,
      "data-slot": "cash-holding-row",
      className: cn(rowClassName, className),
      children: (
        <>
          <TickerChip symbol={CASH_SYMBOL} />
          <span className="grid min-w-0 gap-px leading-[1.35]">
            <span className="text-body-sm font-[550]">Cash</span>
            <span className="text-label-sm text-g-500">
              {reserve === undefined ? "Ready to invest" : `Ready to invest, keep at least ${reserve}%`}
            </span>
            {reserve !== undefined && (
              <AllocationBar weight={weight} cap={reserve} cash label="Cash" className="mt-1.5 max-w-[220px]" />
            )}
          </span>
          <span className="grid justify-items-end gap-px">
            <NumberRoll value={value} format={formatMoney} className="text-body-sm font-semibold" />
            <span className="text-label-sm text-g-500 tabular-nums">{weight.toFixed(1)}%</span>
          </span>
          <Icon name="chevron-right" size={16} className="hidden text-g-300 sm:block" />
        </>
      )
    }
  })
}

function MiniBadge({ tone, children }: { readonly tone: "loss" | "warn"; readonly children: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-[7px] py-px text-caption-sm font-semibold",
        tone === "loss" ?
          "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]" :
          "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
      )}
    >
      {children}
    </span>
  )
}
