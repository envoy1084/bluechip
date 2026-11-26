import NumberFlow, { NumberFlowGroup } from "@number-flow/react"
import { cva } from "class-variance-authority"
import { type ComponentProps, useEffect, useState } from "react"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "../components/popover.tsx"
import { Icon } from "../icons/icon.tsx"
import { cn } from "../lib/cn.ts"
import { formatDate, MARKET_TIME_ZONE } from "../lib/format.ts"

/**
 * Whether US stocks trade right now. `extended` is pre-market, after-hours or overnight trading (prices still move),
 * `paused` is when they don't (weekends and holidays, while stock tokens keep trading), `halted` is one stock paused by
 * its exchange.
 */
export type MarketState = "open" | "extended" | "paused" | "closed" | "weekend" | "halted"

export const marketStatusVariants = cva(
  "inline-flex max-w-full cursor-pointer items-center gap-x-[7px] rounded-[13px] py-1 pr-[11px] pl-[9px] text-label-sm font-semibold whitespace-nowrap transition-[filter] duration-fast ease-brand hover:brightness-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue",
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

export interface MarketStatusProps extends Omit<ComponentProps<"button">, "children"> {
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

export type MarketTimes = {
  readonly [K in "closesAt" | "opensAt" | "lastClose" | "resumesAt"]: Date | number | undefined
}

/** What the chip says and its popover explains for a state. */
export interface MarketExplainer {
  readonly label: string
  /** What the time is, like "Regular trading opens". */
  readonly moment?: string
  readonly at?: Date | number | undefined
  readonly note?: string
}

/** The chip's label for a state, and what its popover explains: when the state changes, and why. */
export const marketExplainer = (
  state: MarketState,
  { closesAt, lastClose, opensAt, resumesAt }: MarketTimes,
  symbol: string | undefined,
  session: string | undefined
): MarketExplainer => {
  switch (state) {
    case "open":
      return { label: "US market open", moment: "Regular trading closes", at: closesAt }
    case "extended":
      return {
        label: session ?? "Extended hours",
        moment: "Regular trading opens",
        at: opensAt,
        note: "Prices still move outside regular hours, with less trading behind them."
      }
    case "paused":
      return {
        label: "Prices paused",
        moment: "Prices move again",
        at: resumesAt,
        note: "Stock tokens still trade, with no live price to compare against."
      }
    case "closed":
      return { label: "Market closed", moment: "Regular trading opens", at: opensAt }
    case "weekend":
      return { label: "Closed for the weekend", moment: "Last close", at: lastClose }
    case "halted":
      return {
        label: symbol === undefined ? "Trading halted" : `${symbol} halted`,
        note: "Its exchange paused trading in this stock."
      }
  }
}

const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

/**
 * Whether US stocks are trading right now, as one chip. Open pulses gently; halted is per stock. Pressing it explains
 * the state and when it changes, in New York time and the viewer's own.
 */
export function MarketStatus(
  { state, closesAt, opensAt, lastClose, symbol, session, resumesAt, className, ...props }: MarketStatusProps
) {
  const { at, label, moment, note } = marketExplainer(
    state,
    { closesAt, lastClose, opensAt, resumesAt },
    symbol,
    session
  )
  const timeZone = localTimeZone()

  return (
    <Popover>
      <PopoverTrigger
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
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] gap-3.5 p-[18px]">
        <PopoverTitle>
          <span className={cn(marketStatusVariants({ state }), "pointer-events-none size-7 justify-center p-0")}>
            {state === "open" ?
              <i aria-hidden className="size-[7px] rounded-full bg-green" /> :
              <Icon name={state === "halted" || state === "paused" ? "pause" : "moon"} size={13} />}
          </span>
          {label}
        </PopoverTitle>
        {moment === undefined || at === undefined ? null : (
          <div className="grid gap-3">
            <Countdown to={at} moment={moment} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md px-3 py-2.5 text-label surface-well">
              <dt className="text-g-500">New York</dt>
              <dd className="text-right font-[550] tabular-nums">{formatDate(at, { timeZone: MARKET_TIME_ZONE })}</dd>
              {timeZone === MARKET_TIME_ZONE ? null : (
                <>
                  <dt className="text-g-500">Your time</dt>
                  <dd className="text-right font-[550] tabular-nums">{formatDate(at, { timeZone })}</dd>
                </>
              )}
            </dl>
          </div>
        )}
        {note === undefined ? null : <PopoverDescription>{note}</PopoverDescription>}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The time left until `to` under `moment`, ticking each second: days, hours and minutes when it's a day or more away,
 * else hours, minutes and seconds. Its digits roll (NumberFlow), and change in place under reduced motion. A time
 * already past (the weekend's last close) is only named.
 */
function Countdown({ to, moment }: Readonly<{ to: Date | number; moment: string }>) {
  const target = new Date(to).getTime()
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  const future = target > start
  useEffect(() => {
    if (!future) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [future])

  if (!future) return <span className="text-label-sm text-g-500">{moment}</span>

  const left = Math.max(0, Math.floor((target - now) / 1000))
  if (left === 0) {
    return (
      <div className="grid gap-1">
        <span className="text-label-sm text-g-500">{moment}</span>
        <span className="text-[26px] leading-none font-semibold tracking-[-0.03em]">Any moment now</span>
      </div>
    )
  }

  const days = Math.floor(left / 86_400)
  const hours = Math.floor((left % 86_400) / 3600)
  const minutes = Math.floor((left % 3600) / 60)
  const seconds = left % 60
  const units: ReadonlyArray<readonly [number, string]> = days > 0 ?
    [[days, "d"], [hours, "h"], [minutes, "m"]] :
    [[hours, "h"], [minutes, "m"], [seconds, "s"]]

  return (
    <div className="grid gap-1.5">
      <span className="text-label-sm text-g-500">{moment} in</span>
      <NumberFlowGroup>
        <span
          role="timer"
          aria-label={units.map(([value, unit]) => `${value}${unit}`).join(" ")}
          className="flex items-baseline gap-2.5 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums"
        >
          {units.map(([value, unit]) => (
            <span key={unit} className="inline-flex items-baseline">
              <NumberFlow value={value} format={{ minimumIntegerDigits: 2 }} trend={-1} />
              <span className="ml-0.5 text-[15px] font-medium text-g-500">{unit}</span>
            </span>
          ))}
        </span>
      </NumberFlowGroup>
    </div>
  )
}
