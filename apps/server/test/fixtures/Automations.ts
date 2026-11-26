// Automation drafts the tests save, fire and change.
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS, type Settings } from "@bluechip/domain/automations/Settings"
import type { AgentId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"

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

/** When NVIDIA falls `bps` from its high, sell half of it. */
export const nvidiaStopLoss = (
  agentId: AgentId | null,
  bps = 1000,
  settings: Partial<Settings> = {}
): AutomationDraft =>
  new AutomationDraft({
    name: "NVIDIA stop-loss",
    agentId,
    trigger: { type: "priceMove", config: { symbol: "NVDA", reference: "trailingHigh", bps, direction: "down" } },
    conditions: [],
    action: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } },
    settings: { ...DEFAULT_SETTINGS, ...settings }
  })
