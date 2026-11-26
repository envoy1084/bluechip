import type { Action, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import type { IconName } from "@bluechip/ui/icons/icon"

/** The icon each trigger, condition and action is shown with in the editor. */
export const ENTRY_ICONS: Readonly<Record<Trigger["type"] | Condition["type"] | Action["type"], IconName>> = {
  schedule: "calendar",
  priceMove: "chart-down",
  priceCross: "flag",
  drift: "scales",
  portfolio: "pie",
  news: "news",
  marketOpen: "sun",
  pricesFresh: "refresh",
  priceAbove: "arrow-up",
  priceBelow: "arrow-down",
  holdingAtLeast: "wallet",
  timeWindow: "clock",
  all: "layers",
  any: "grid",
  not: "stop-sign",
  judgment: "sparkline",
  buy: "plus",
  sell: "minus",
  sellShare: "pie",
  rebalance: "scales",
  notify: "bell",
  ask: "face-id"
}
