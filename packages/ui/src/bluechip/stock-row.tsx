import { useRender } from "@base-ui/react/use-render"
import type { ReactNode } from "react"
import { cn } from "../lib/cn.ts"
import { TickerChip } from "./ticker-chip.tsx"

export interface StockRowProps extends Omit<useRender.ComponentProps<"a">, "children"> {
  readonly symbol: string
  /** The stock's name, or what the row is about it. */
  readonly name: ReactNode
  /** The line under the name: what you hold, the session, what it cost. */
  readonly detail?: ReactNode
  /** Between the name and `trailing`, from small screens up: a sparkline. */
  readonly aside?: ReactNode
  /** At the end: its value, price or change. */
  readonly trailing: ReactNode
  /** The ticker chip's size: `sm` in a card's list, `md` in a page's list. */
  readonly size?: "sm" | "md"
}

/**
 * One stock in a list, the same wherever stocks are listed (today's movers, the stocks list, what each stock added to
 * your results): its chip, its name with a line under it, and what matters at its end. Pass the router's link as
 * `render` (`render={<Link to="/stocks/$symbol" params={{ symbol }} />}`), so it opens in a new tab like any link.
 */
export function StockRow(
  { symbol, name, detail, aside, trailing, size = "sm", className, render, ...props }: StockRowProps
) {
  return useRender({
    defaultTagName: "a",
    render,
    props: {
      ...props,
      "data-slot": "stock-row",
      className: cn(
        "grid items-center gap-3 border-b border-g-100 bg-white px-4 py-3 text-left last:border-b-0",
        aside === undefined ?
          "grid-cols-[auto_minmax(0,1fr)_auto]" :
          "grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
        "transition-colors duration-fast ease-brand hover:bg-g-50",
        "focus-visible:shadow-[inset_0_0_0_2px_var(--color-blue)] focus-visible:outline-none",
        className
      ),
      children: (
        <>
          <TickerChip symbol={symbol} size={size} className="justify-self-start" />
          <span className="grid min-w-0 gap-px">
            <b className="truncate text-body-sm font-[550]">{name}</b>
            {detail === undefined ?
              null :
              (
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-px text-label-sm text-g-500 tabular-nums">
                  {detail}
                </span>
              )}
          </span>
          {aside === undefined ? null : <span className="hidden sm:block">{aside}</span>}
          <span className="flex justify-end text-right">{trailing}</span>
        </>
      )
    }
  })
}
