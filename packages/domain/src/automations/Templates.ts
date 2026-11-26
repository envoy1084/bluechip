/**
 * The automations a template comes with: a Weekly buyer buys weekly, a Stop-loss guard sells on a fall from the high,
 * a Rebalancer trades back to its mix when it drifts; a Stock picker comes with none. They are drafts for the new
 * agent's flow, where you edit or remove each before it is saved; each fits the agent's policies.
 *
 * @since 0.0.0
 */
import type { AgentId } from "../Ids.ts"
import { Shares, Usdc } from "../market/Units.ts"
import type { AgentSpec } from "../policies/AgentSpec.ts"
import { configOf } from "../policies/Policy.ts"
import { rebalance } from "../policies/Rebalance.ts"
import { limitsOf } from "./AgentLimits.ts"
import { AutomationDraft } from "./Automation.ts"
import { DEFAULT_SETTINGS } from "./Settings.ts"
import type { Weekday } from "./Time.ts"

const WEEKDAYS: ReadonlyArray<Weekday> = ["monday", "tuesday", "wednesday", "thursday", "friday"]

/**
 * The default automations for an agent made from `template` with `spec`: none for a Stock picker, a custom spec or
 * a saved template.
 *
 * **Example** (A Weekly buyer of NVIDIA)
 *
 * ```ts import.meta.vitest
 * import { defaultAutomations } from "@bluechip/domain/automations/Templates"
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * defaultAutomations("weeklyBuyer", spec, "agent_01jd8v4t5m6n7p8q9r0s1t2v3w" as never).map((draft) => draft.name)
 * // => ["Weekly buy of NVDA"]
 * ```
 *
 * @stability unstable
 * @category templates
 * @since 0.0.0
 */
export const defaultAutomations = (
  template: string | null,
  spec: AgentSpec,
  agentId: AgentId
): ReadonlyArray<AutomationDraft> => {
  const limits = limitsOf(spec)!
  switch (template) {
    case "weeklyBuyer": {
      // A weekday each, so each day's buy is the one trade a day it makes; its largest trade, within its budget.
      const amount = Usdc.make(
        limits.maxPerTrade === null || limits.maxPerTrade > limits.dailyBudget ? limits.dailyBudget : limits.maxPerTrade
      )
      return limits.stocks.map((symbol, index) =>
        new AutomationDraft({
          name: `Weekly buy of ${symbol}`,
          agentId,
          trigger: {
            type: "schedule",
            config: { days: [WEEKDAYS[index % WEEKDAYS.length]!], time: "10:00", timeZone: "America/New_York" }
          },
          conditions: [],
          action: { type: "buy", config: { amount, split: [{ symbol, weight: 10_000 }] } },
          settings: DEFAULT_SETTINGS
        })
      )
    }
    case "stopLossGuard":
      return limits.stocks.map((symbol) =>
        new AutomationDraft({
          name: `${symbol} stop-loss`,
          agentId,
          trigger: { type: "priceMove", config: { symbol, reference: "trailingHigh", bps: 1000, direction: "down" } },
          conditions: [{ type: "holdingAtLeast", config: { symbol, shares: Shares.make(BigInt(0)) } }],
          action: { type: "sellShare", config: { symbol, bps: 5000 } },
          settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 24 * 60 }
        })
      )
    case "rebalancer":
      return configOf(spec.policies, rebalance) === undefined ? [] : [
        new AutomationDraft({
          name: "Rebalance on drift",
          agentId,
          trigger: { type: "drift", config: {} },
          conditions: [],
          action: { type: "rebalance", config: {} },
          settings: DEFAULT_SETTINGS
        })
      ]
    default:
      return []
  }
}
