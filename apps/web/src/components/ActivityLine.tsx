import type { ActivityItem as Activity } from "@bluechip/domain/activity/Activity"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ActivityItem } from "@bluechip/ui/bluechip/activity-item"
import type { IconName } from "@bluechip/ui/icons/icon"
import { formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { activityAt, activityDetail, activityTitle } from "../lib/activityText.ts"
import { localTimeZone } from "../lib/localTime.ts"

const iconOf = (item: Activity): IconName => {
  if (item._tag === "Withdrawal") return item.transfer.kind === "deposit" ? "download" : "upload"
  return item.trade.side === "buy" ? "arrow-down-right" : "arrow-up-right"
}

const failed = (item: Activity) =>
  item._tag === "Trade" ? item.trade.status === "failed" : item.transfer.status === "failed"

/** One compact activity row: what happened and when, opening its details when pressed. */
export function ActivityLine(
  { item, names, onOpen }: Readonly<{
    item: Activity
    names: ReadonlyMap<StockSymbol, string>
    onOpen?: () => void
  }>
) {
  return (
    <ActivityItem
      kind={failed(item) ? "blocked" : item._tag === "Trade" ? "trade" : "deposit"}
      icon={iconOf(item)}
      title={activityTitle(item, names)}
      // Only the time: the list groups rows by day.
      time={formatTime(DateTime.toDateUtc(activityAt(item)), { timeZone: localTimeZone() })}
      {...(onOpen === undefined ? {} : { onOpen })}
    >
      {activityDetail(item)}
    </ActivityItem>
  )
}
