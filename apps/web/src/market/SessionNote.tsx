import type { MarketPrice } from "@bluechip/domain/market/Market"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatTime, MARKET_TIME_ZONE } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import { SESSION_LABEL, useMarketStatus } from "./marketState.ts"

// Alpaca's free feed is IEX only: thin after hours and silent overnight, so an old last trade is said as such.
const QUIET = Duration.minutes(30)

/**
 * Where a stock's market price stands: trading now, in an extended session, from a last trade a while ago (the free
 * feed goes quiet overnight), or paused for the weekend or a holiday.
 */
export function SessionNote({ price }: Readonly<{ price: MarketPrice }>) {
  const status = useMarketStatus()
  if (status === undefined) return null

  if (status.session === "paused") {
    return (
      <span className="inline-flex items-center gap-[5px] text-caption text-warn">
        <Icon name="pause" size={12} />Price paused
      </span>
    )
  }

  if (Duration.isGreaterThan(DateTime.distance(price.tradedAt, status.asOf), QUIET)) {
    const time = formatTime(DateTime.toDateUtc(price.tradedAt), { timeZone: MARKET_TIME_ZONE })
    return (
      <span className="inline-flex items-center gap-[5px] text-caption text-g-500">
        <Icon name="moon" size={12} />Last trade {time}
      </span>
    )
  }

  const regular = status.session === "regular"
  return (
    <span className="inline-flex items-center gap-[5px] text-caption text-g-500">
      <i
        aria-hidden
        className={regular ?
          "size-1.5 rounded-full bg-green shadow-[0_0_0_2.5px_rgba(102,200,0,.2)]" :
          "size-1.5 rounded-full bg-blue shadow-[0_0_0_2.5px_rgba(42,91,255,.18)]"}
      />
      {regular ? "Trading now" : SESSION_LABEL[status.session]}
    </span>
  )
}
