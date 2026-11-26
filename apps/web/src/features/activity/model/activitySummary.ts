// The period at a glance, above the list: what was bought and sold, and the cash that came in and went out. Only what
// finished counts (a filled trade, a transfer that landed); a trade on its way or one that didn't go through moved
// nothing yet.
import type { ActivityItem, ActivityKind } from "@bluechip/domain/activity/Activity"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../lib/amounts.ts"

export interface ActivityTotals {
  readonly bought: bigint
  readonly buys: number
  readonly sold: bigint
  readonly sells: number
  readonly added: bigint
  readonly deposits: number
  readonly withdrew: bigint
  readonly withdrawals: number
}

export interface SummaryTile {
  readonly label: string
  readonly value: string
  readonly detail: string
}

const sum = (amounts: ReadonlyArray<bigint>) => amounts.reduce((total, amount) => total + amount, BigInt(0))

/** The finished trades' and cash transfers' totals; transfers of stock aren't cash, so they don't count. */
export const activityTotals = (items: ReadonlyArray<ActivityItem>): ActivityTotals => {
  const filled = items.flatMap((item) => item._tag === "Trade" && item.trade.status === "filled" ? [item.trade] : [])
  const landed = items.flatMap((item) =>
    item._tag === "Withdrawal" && item.transfer.status === "confirmed" && item.transfer.asset === "USDC" ?
      [item.transfer] :
      []
  )

  const buys = filled.filter((trade) => trade.side === "buy").map((trade) => trade.usdc)
  const sells = filled.filter((trade) => trade.side === "sell").map((trade) => trade.usdc)
  const deposits = landed.filter((transfer) => transfer.kind === "deposit").map((transfer) => transfer.amount)
  const withdrawals = landed.filter((transfer) => transfer.kind === "withdrawal").map((transfer) => transfer.amount)

  return {
    bought: sum(buys),
    buys: buys.length,
    sold: sum(sells),
    sells: sells.length,
    added: sum(deposits),
    deposits: deposits.length,
    withdrew: sum(withdrawals),
    withdrawals: withdrawals.length
  }
}

const count = (n: number, one: string, many: string) => n === 0 ? "None" : `${n} ${n === 1 ? one : many}`

/** The tiles the strip shows for a filter: trades' for Trades, cash's for Cash, both for All. */
export const summaryTiles = (totals: ActivityTotals, kind: typeof ActivityKind.Type): ReadonlyArray<SummaryTile> => {
  const trades: ReadonlyArray<SummaryTile> = [
    { label: "Bought", value: formatMoney(usdcDollars(totals.bought)), detail: count(totals.buys, "buy", "buys") },
    { label: "Sold", value: formatMoney(usdcDollars(totals.sold)), detail: count(totals.sells, "sale", "sales") }
  ]
  const cash: ReadonlyArray<SummaryTile> = [
    {
      label: "Added",
      value: formatMoney(usdcDollars(totals.added)),
      detail: count(totals.deposits, "deposit", "deposits")
    },
    {
      label: "Withdrew",
      value: formatMoney(usdcDollars(totals.withdrew)),
      detail: count(totals.withdrawals, "withdrawal", "withdrawals")
    }
  ]
  if (kind === "trades") return trades
  if (kind === "cash") return cash
  return [...trades, ...cash]
}
