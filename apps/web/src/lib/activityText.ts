// How an activity item reads wherever it's listed: its title, the line under it and its status as a pill. A trade reads
// by where it is ("Buying", "Bought", or the buy that didn't go through), a transfer by which way the money went.
import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { shortAddress } from "@bluechip/ui/bluechip/address-chip"
import { formatMoney, formatShareCount } from "@bluechip/ui/lib/format"
import type * as DateTime from "effect/DateTime"
import { priceDollars, shareCount, usdcDollars } from "./amounts.ts"
import { nothingMoved } from "./tradeOutcome.ts"

type Transfer = Extract<ActivityItem, { _tag: "Withdrawal" }>["transfer"]

/** How a status pill looks: done, on its way, or ended without moving money. */
export type ActivityTone = "done" | "pending" | "failed"

/** When an item happened. */
export const activityAt = (item: ActivityItem): DateTime.Utc =>
  item._tag === "Trade" ? item.trade.createdAt : item.transfer.createdAt

/** An item's id, unique across trades and transfers. */
export const activityId = (item: ActivityItem): string => item._tag === "Trade" ? item.trade.id : item.transfer.id

/** What moved in a transfer: dollars of cash, or shares of a stock. */
const transferAmount = (transfer: Transfer, names: ReadonlyMap<StockSymbol, string>): string =>
  transfer.asset === "USDC" ?
    formatMoney(usdcDollars(transfer.amount)) :
    `${formatShareCount(shareCount(transfer.amount))} of ${names.get(transfer.asset) ?? transfer.asset}`

/**
 * What happened, as the item's title: "Bought $92.95 of Apple", "Buying $92.95 of Apple" on its way, "Buy $92.95 of
 * Apple" when it didn't go through; "Added $500.00", "Withdrew $15.00", or the "Withdrawal of $15.00" that failed.
 */
export const activityTitle = (item: ActivityItem, names: ReadonlyMap<StockSymbol, string>): string => {
  if (item._tag === "Withdrawal") {
    const { kind, status } = item.transfer
    const amount = transferAmount(item.transfer, names)
    if (kind === "deposit") return status === "failed" ? `Deposit of ${amount}` : `Added ${amount}`
    // A pending withdrawal already left your cash; its pill says it's on its way.
    return status === "failed" ? `Withdrawal of ${amount}` : `Withdrew ${amount}`
  }

  const { side, status, symbol, usdc } = item.trade
  const what = `${formatMoney(usdcDollars(usdc))} of ${names.get(symbol) ?? symbol}`
  const buying = side === "buy"
  if (status === "filled") return `${buying ? "Bought" : "Sold"} ${what}`
  if (status === "failed") return `${buying ? "Buy" : "Sell"} ${what}`
  return `${buying ? "Buying" : "Selling"} ${what}`
}

/**
 * The line under the title: a trade's shares and price (quoted until it fills) or that nothing moved, a transfer's
 * address on Base or that the cash stayed put.
 */
export const activityDetail = (item: ActivityItem): string => {
  if (item._tag === "Withdrawal") {
    const { from, kind, status, to } = item.transfer
    if (status === "failed") return kind === "deposit" ? "Nothing arrived." : "Your cash is where it was."
    return kind === "deposit" ? `From ${shortAddress(from)} on Base` : `To ${shortAddress(to)} on Base`
  }

  const { price, shares, side, status } = item.trade
  if (status === "failed") return nothingMoved(side)
  const detail = `${formatShareCount(shareCount(shares))} at ${formatMoney(priceDollars(price))}`
  return status === "filled" ? detail : `About ${detail}`
}

/** Where an item stands, as its pill. */
export const activityStatus = (item: ActivityItem): { readonly label: string; readonly tone: ActivityTone } => {
  if (item._tag === "Withdrawal") {
    const { kind, status } = item.transfer
    if (status === "failed") return { label: "Didn't go through", tone: "failed" }
    if (status === "pending") return { label: "On its way", tone: "pending" }
    return { label: kind === "deposit" ? "Arrived" : "Sent", tone: "done" }
  }

  switch (item.trade.status) {
    case "sending":
      return { label: "Sending", tone: "pending" }
    case "confirming":
      return { label: "Confirming", tone: "pending" }
    case "filled":
      return { label: "Filled", tone: "done" }
    case "failed":
      return { label: "Didn't go through", tone: "failed" }
  }
}

/** What went wrong with an item that didn't go through, in a sentence; `null` for the rest. */
export const activityProblem = (item: ActivityItem): string | null => {
  if (item._tag === "Trade") return item.trade.status === "failed" ? "Base didn't take this trade." : null
  if (item.transfer.status !== "failed") return null
  return item.transfer.kind === "deposit" ? "This deposit didn't land." : "Base didn't take this withdrawal."
}
