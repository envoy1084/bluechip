// How a policy's field reads on screen, from its unit: "$250", "30%", "Nvidia and Apple", "Buy only", "Nvidia at $150".
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { formatDollars, formatPercent, formatPrice, listNames } from "@bluechip/domain/policies/Format"
import type { Field } from "@bluechip/domain/policies/Policy"
import type { Target } from "@bluechip/domain/policies/Rebalance"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import type { Direction } from "@bluechip/domain/policies/Trade"
import * as DateTime from "effect/DateTime"

export const DIRECTION_LABELS: Readonly<Record<Direction, string>> = {
  both: "Buy and sell",
  buy: "Buy only",
  sell: "Sell only",
  rebalance: "Rebalance only"
}

/** USDC units as dollars, for inputs and meters. */
export const toDollars = (amount: bigint | number): number => Number(amount) / 1_000_000

/** One field's value as the review shows it. */
export const fieldText = (field: Field, value: unknown, nameOf: (symbol: StockSymbol) => string): string => {
  switch (field.unit) {
    case "usd":
      return formatDollars(value as bigint)
    case "bps":
      return formatPercent(value as number)
    case "count":
      return String(value)
    case "toggle":
      return value === true ? "On" : "Off"
    case "stocks":
      return listNames((value as ReadonlyArray<StockSymbol>).map(nameOf))
    case "direction":
      return DIRECTION_LABELS[value as Direction]
    case "mix":
      // "Nvidia 40%, Apple 30% and cash 30%"
      return listNames(
        (value as ReadonlyArray<Target>).map((target) =>
          `${target.asset === "USDC" ? "cash" : nameOf(target.asset)} ${formatPercent(target.weight)}`
        )
      )
    case "floors":
      // "Nvidia at $150 and Apple at $180.50"
      return listNames(
        (value as ReadonlyArray<Floor>).map((floor) => `${nameOf(floor.symbol)} at ${formatPrice(floor.price)}`)
      )
    case "wei":
      return `${Number(value as bigint) / 1e9} gwei`
  }
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

/** A day as the agent screens say it: "21 Feb". */
export const dayLabel = (date: Date | DateTime.Utc): string =>
  dayFormat.format(date instanceof Date ? date : DateTime.toDateUtc(date))
