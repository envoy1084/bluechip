import type { ActivityItem as Activity } from "@bluechip/domain/activity/Activity"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ActivityItem } from "@bluechip/ui/bluechip/activity-item"
import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { formatMoney, formatShares, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { priceDollars, shareCount, usdcDollars } from "../lib/amounts.ts"
import { localTimeZone } from "../lib/localTime.ts"

/** When an item happened. */
export const activityAt = (item: Activity) => item._tag === "Trade" ? item.trade.createdAt : item.transfer.createdAt

/** What an item says: a trade's result in words, a withdrawal's amount and address. */
export const describeActivity = (item: Activity, names: ReadonlyMap<StockSymbol, string>) => {
  if (item._tag === "Withdrawal") {
    const { amount, status, to } = item.transfer
    const money = formatMoney(usdcDollars(amount))
    return {
      kind: "deposit" as const,
      icon: "upload" as const,
      title: status === "failed" ? `Withdrawal of ${money} didn't go through` : `Withdrew ${money}`,
      body: status === "failed" ? "Your cash is where it was." : `To ${shortAddress(to)} on Base`
    }
  }

  const { price, shares, side, status, symbol, usdc } = item.trade
  const name = names.get(symbol) ?? symbol
  const buying = side === "buy"
  const money = formatMoney(usdcDollars(usdc))
  const detail = `${formatShares(shareCount(shares))} shares at ${formatMoney(priceDollars(price))}`

  return {
    kind: status === "failed" ? "blocked" as const : "trade" as const,
    icon: (buying ? "arrow-down-right" : "arrow-up-right") as "arrow-down-right" | "arrow-up-right",
    title: status === "failed" ?
      `${buying ? "Buy" : "Sale"} of ${name} didn't go through` :
      status === "filled" ?
      `${buying ? "Bought" : "Sold"} ${money} of ${name}` :
      `${buying ? "Buying" : "Selling"} ${money} of ${name}`,
    body: status === "failed"
      ? `${buying ? "Nothing was bought" : "Nothing was sold"}. Your money is where it was.`
      : detail
  }
}

/** One activity row: what happened and when, opening its details when pressed. */
export function ActivityLine(
  { item, names, onOpen }: Readonly<{
    item: Activity
    names: ReadonlyMap<StockSymbol, string>
    onOpen?: () => void
  }>
) {
  const { body, icon, kind, title } = describeActivity(item, names)
  return (
    <ActivityItem
      kind={kind}
      icon={icon}
      title={title}
      // Only the time: the list groups rows by day.
      time={formatTime(DateTime.toDateUtc(activityAt(item)), { timeZone: localTimeZone() })}
      {...(onOpen === undefined ? {} : { onOpen })}
    >
      {body}
    </ActivityItem>
  )
}
