import { cva } from "class-variance-authority"
import type { ComponentProps } from "react"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatMarketTime, formatTime, MARKET_TIME_ZONE } from "../lib/format.ts"

/**
 * Whether US stocks trade right now. `extended` is pre-market, after-hours or overnight trading (prices still move),
 * `paused` is when they don't (weekends and holidays, while stock tokens keep trading), `halted` is one stock paused by
 * its exchange.
 */
export type MarketState = "open" | "extended" | "paused" | "closed" | "weekend" | "halted"

export const marketStatusVariants = cva(
  "inline-flex max-w-full flex-wrap items-center gap-x-[7px] rounded-[13px] py-1 pr-[11px] pl-[9px] text-label-sm font-semibold [&>span]:whitespace-nowrap",
  {
    variants: {
      state: {
        open: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
        extended: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
        paused: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
        closed: "bg-[linear-gradient(180deg,#fff,#f4f5f7)] text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        weekend: "bg-[linear-gradient(180deg,#fff,#f4f5f7)] text-g-700 shadow-[inset_0_0_0_1px_var(--color-g-200)]",
        halted: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]"
      }
    }
  }
)

export interface MarketStatusProps extends Omit<ComponentProps<"span">, "children"> {
  readonly state: MarketState
  /** Open: when it closes today. */
  readonly closesAt?: Date | number
  /** Closed: when it opens next. */
  readonly opensAt?: Date | number
  /** Weekend: the last close, said in New York time first. */
  readonly lastClose?: Date | number
  /** Halted: the stock that's paused. */
  readonly symbol?: string
  /** Extended: which session ("After hours", "Overnight"…). */
  readonly session?: string
  /** Paused: when prices start moving again. */
  readonly resumesAt?: Date | number
}

const nyTime = (date: Date | number) => formatTime(date, { timeZone: MARKET_TIME_ZONE, zone: true })

/** Whether US stocks are trading right now, and when that changes. Open pulses gently; halted is per stock. */
export function MarketStatus(
  { state, closesAt, opensAt, lastClose, symbol, session, resumesAt, className, ...props }: MarketStatusProps
) {
  const [label, detail] = {
    open: ["US market open", closesAt === undefined ? undefined : `closes ${nyTime(closesAt)}`],
    extended: [
      session ?? "Extended hours",
      opensAt === undefined ? undefined : `market opens ${formatMarketTime(opensAt)}`
    ],
    paused: ["Prices paused", resumesAt === undefined ? undefined : `back ${formatMarketTime(resumesAt)}`],
    closed: ["Market closed", opensAt === undefined ? undefined : `opens ${nyTime(opensAt)}`],
    weekend: [
      "Closed for the weekend",
      lastClose === undefined ? undefined : `last close ${formatMarketTime(lastClose)}`
    ],
    halted: [symbol === undefined ? "Trading halted" : `${symbol} halted`, "by exchange"]
  }[state]
  return (
    <span
      data-slot="market-status"
      data-state={state}
      className={cn(marketStatusVariants({ state }), className)}
      {...props}
    >
      {state === "open" ?
        (
          <i aria-hidden className="relative size-[7px] rounded-full bg-green">
            <i className="absolute -inset-1 animate-ping rounded-full bg-green opacity-40 [animation-duration:2.4s] motion-reduce:hidden" />
          </i>
        ) :
        (
          <Icon
            name={state === "halted" || state === "paused" ? "pause" : "moon"}
            size={13}
            className={state === "closed" || state === "weekend" ? "text-[#5b4fd6]" : ""}
          />
        )}
      <span>{label}</span>
      {detail && <span className="font-medium opacity-75">· {detail}</span>}
    </span>
  )
}
