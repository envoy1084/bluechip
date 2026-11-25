import type { IconName } from "@bluechip/ui/icons/icon"

/* ---------- Demo data from bluechip's world ---------- */

export interface Stock {
  readonly value: string
  readonly label: string
  readonly name: string
  readonly price: number
}

export const STOCKS: ReadonlyArray<Stock> = [
  ["NVDA", "Nvidia", 181.42],
  ["AAPL", "Apple", 241.18],
  ["MSFT", "Microsoft", 455.6],
  ["META", "Meta", 612.3],
  ["TSLA", "Tesla", 352.75],
  ["GOOGL", "Alphabet", 178.9],
  ["AMZN", "Amazon", 214.36],
  ["MSTR", "Strategy", 318.2],
  ["SNDK", "Sandisk", 64.85],
  ["SPCX", "SpaceX", 98.4],
  ["ANT", "Anthropic", 79.46],
  ["CRCL", "Circle", 47.12],
  ["INTC", "Intel", 53.62]
].map(([value, name, price]) => ({
  value: String(value),
  name: String(name),
  label: `${value} (${name})`,
  price: Number(price)
}))

export const TEMPLATES: ReadonlyArray<
  { readonly id: string; readonly name: string; readonly icon: IconName; readonly say: string }
> = [
  {
    id: "rebalancer",
    name: "Rebalancer",
    icon: "scales",
    say: "Keeps your mix on target. Only rebalances, never adds cash."
  },
  {
    id: "stock-picker",
    name: "Stock picker",
    icon: "target",
    say: "Buys from a short list you choose, inside your limits."
  },
  {
    id: "weekly-buyer",
    name: "Weekly buyer",
    icon: "calendar",
    say: "Buys the same amount every week, on the day you pick."
  },
  {
    id: "stop-loss",
    name: "Stop-loss guard",
    icon: "shield",
    say: "Sells a stock when it falls past the line you set."
  }
]

export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
export const USD_WHOLE = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const
export const PERCENT = { style: "unit", unit: "percent" } as const
