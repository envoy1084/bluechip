// Automation drafts as a form or the assistant makes them, and the agents they run for.
import type { Action, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS, type Settings } from "@bluechip/domain/automations/Settings"
import { Price, Usdc } from "@bluechip/domain/market/Units"
import { draftSpec } from "@bluechip/domain/policies/Templates"

// $250 a day, $100 a trade, $5 smallest, 1 trade a day, NVDA and AAPL, only buys.
export const WEEKLY_BUYER = draftSpec({
  template: "weeklyBuyer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: []
})

// $100 a trade, 4 trades a day, NVDA, only sells.
export const STOP_LOSS_GUARD = draftSpec({
  template: "stopLossGuard",
  preset: "balanced",
  stocks: ["NVDA"],
  targets: []
})

export const EVERY_MONDAY: Trigger = {
  type: "schedule",
  config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" }
}

export const NVDA_FALLS_10: Trigger = {
  type: "priceMove",
  config: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" }
}

export const BUY_50_AAPL: Action = {
  type: "buy",
  config: { amount: Usdc.make(50_000_000n), split: [{ symbol: "AAPL", weight: 10_000 }] }
}

export const SELL_HALF_NVDA = { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } } as const satisfies Action

/** NVIDIA's price: `dollars` as USD × 1e8. */
export const price = (dollars: number): Price => Price.make(BigInt(Math.round(dollars * 1e8)))

/** A draft with no conditions and the default settings, unless the parts say otherwise. */
export const draft = (parts: {
  readonly trigger?: Trigger
  readonly conditions?: ReadonlyArray<Condition>
  readonly action?: Action
  readonly settings?: Partial<Settings>
}): AutomationDraft =>
  new AutomationDraft({
    name: "Test automation",
    agentId: null,
    trigger: parts.trigger ?? EVERY_MONDAY,
    conditions: parts.conditions ?? [],
    action: parts.action ?? BUY_50_AAPL,
    settings: { ...DEFAULT_SETTINGS, ...parts.settings }
  })
