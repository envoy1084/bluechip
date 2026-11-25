import type { IconName } from "@bluechip/ui/icons/icon"

export const AGENTS: ReadonlyArray<
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
  },
  {
    id: "custom",
    name: "Your own",
    icon: "chat",
    say: "Describe it in chat. bluechip turns it into limits you approve."
  }
]

export const LIMITS: ReadonlyArray<readonly [string, string]> = [
  ["Spend per day", "$250"],
  ["Max per trade", "$100"],
  ["Max in one stock", "25%"],
  ["Cash reserve", "$200"],
  ["Fair price check", "Within 1%"],
  ["Approval needed above", "$500"],
  ["Stocks allowed", "NVDA · AAPL · MSFT"],
  ["Rebalance only", "Yes"]
]
