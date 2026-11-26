// Automation drafts the tests save, fire and change.
import { AutomationDraft, type Condition } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS, type Settings } from "@bluechip/domain/automations/Settings"
import type { AgentId } from "@bluechip/domain/Ids"
import { MarketPrice } from "@bluechip/domain/market/Market"
import { Price, Usdc } from "@bluechip/domain/market/Units"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"

/** Every Monday at 10:00 New York time, buy $50 of NVIDIA: for `agentId`, or yourself with `null`. */
export const weeklyNvidia = (agentId: AgentId | null, settings: Partial<Settings> = {}): AutomationDraft =>
  new AutomationDraft({
    name: "Weekly NVIDIA",
    agentId,
    trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
    conditions: [],
    action: { type: "buy", config: { amount: Usdc.make(50_000_000n), split: [{ symbol: "NVDA", weight: 10_000 }] } },
    settings: { ...DEFAULT_SETTINGS, ...settings }
  })

/** When NVIDIA falls 10% (or `bps`) from its high, sell half of it, if the conditions hold. */
export const nvidiaStopLoss = (agentId: AgentId | null, options: {
  readonly bps?: number
  readonly conditions?: ReadonlyArray<Condition>
  readonly settings?: Partial<Settings>
} = {}): AutomationDraft =>
  new AutomationDraft({
    name: "NVIDIA stop-loss",
    agentId,
    trigger: {
      type: "priceMove",
      config: { symbol: "NVDA", reference: "trailingHigh", bps: options.bps ?? 1000, direction: "down" }
    },
    conditions: options.conditions ?? [],
    action: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } },
    settings: { ...DEFAULT_SETTINGS, ...options.settings }
  })

/** A Stop-loss guard for NVIDIA: only sells, $100 a trade, 4 trades a day. */
export const STOP_LOSS_GUARD = draftSpec({
  template: "stopLossGuard",
  preset: "balanced",
  stocks: ["NVDA"],
  targets: []
})

/** NVIDIA's market price at `dollars` a token, traded now. */
export const nvidiaAt = (dollars: number): MarketPrice =>
  new MarketPrice({
    symbol: "NVDA",
    price: Price.make(BigInt(Math.round(dollars * 1e8))),
    tradedAt: DateTime.nowUnsafe(),
    previousClose: null
  })

/** Settings that fire whether or not the market is open, so tests run at any hour. */
export const AROUND_THE_CLOCK = { marketHoursOnly: false } as const

/** What fired a run in tests that fire one directly. */
export const TEST_FIRE = { summary: "A test fired it.", symbol: null, price: null, newsItemId: null } as const
