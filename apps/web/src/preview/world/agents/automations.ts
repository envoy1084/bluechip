// A preview automation as the server keeps it: the `Automation` (read in sentences by the domain's own
// `describeAutomation`) and its runs, built from the cast's kinds with the catalog's entries, so the editor and the
// sentences read them as they would a real one.
import {
  Automation,
  AutomationDraft,
  type AutomationStatus,
  describeAutomation
} from "@bluechip/domain/automations/Automation"
import type { AutomationRun, Judgment } from "@bluechip/domain/automations/Run"
import { DEFAULT_SETTINGS, type Settings } from "@bluechip/domain/automations/Settings"
import { nextRun } from "@bluechip/domain/automations/triggers/Schedule"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import * as DateTime from "effect/DateTime"
import type { CastAutomation } from "../cast.ts"
import { stockName } from "./stockName.ts"

export interface AutomationRecord {
  automation: Automation
  /** Newest first. */
  runs: Array<AutomationRun>
  judgments: Array<Judgment>
  /** The create request it was saved by, so a retried one saves it once. */
  readonly requestKey: string | null
}

type AutomationFields = Omit<ConstructorParameters<typeof Automation>[0], "description" | "nextRunAt">

/** The automation with its sentences and, for an active or paused schedule, its next time after `now`. */
const automationOf = (fields: AutomationFields, now: DateTime.Utc): Automation =>
  new Automation({
    ...fields,
    description: describeOf(fields),
    nextRunAt: fields.trigger.type === "schedule" && (fields.status === "active" || fields.status === "paused") ?
      nextRun(fields.trigger.config, now) :
      null
  })

const describeOf = (fields: Pick<AutomationFields, "trigger" | "conditions" | "action" | "settings">) =>
  describeAutomation(fields, stockName)

/** Saves changes to it, its sentences and next time read again. */
export const saveAutomation = (
  record: AutomationRecord,
  changes: Partial<AutomationFields>,
  now: DateTime.Utc
) => {
  record.automation = automationOf({ ...record.automation, updatedAt: now, ...changes }, now)
}

/** Prices the made-up runs read, in dollars. */
const PRICES: Readonly<Partial<Record<StockSymbol, number>>> = {
  AAPL: 231.4,
  AMZN: 201.15,
  GOOGL: 176.8,
  META: 612.3,
  MSFT: 428.9,
  NVDA: 138.6,
  TSLA: 248.7
}

export const priceOf = (symbol: StockSymbol, factor = 1): Price =>
  Price.make(BigInt(Math.round((PRICES[symbol] ?? 100) * factor * 100)) * BigInt(1_000_000))

const dollars = (amount: number) => Usdc.make(BigInt(amount) * BigInt(1_000_000))

// The stock an automation's name says by its first word ("Weekly Apple", "One-off Meta buy"), else the agent's
// first, else Apple.
const symbolOf = (name: string, spec: AgentSpec | null): StockSymbol => {
  const stocks = spec === null ? [] : configOf(spec.policies, trade)?.stocks ?? []
  const named = (["AAPL", "AMZN", "GOOGL", "META", "MSFT", "NVDA", "TSLA"] as const).find((symbol) =>
    name.toLowerCase().includes(stockName(symbol).split(" ")[0]!.toLowerCase())
  )
  return named ?? stocks[0] ?? "AAPL"
}

// Its largest trade within its budget, at most $50.
const buyAmount = (spec: AgentSpec | null): Usdc => {
  if (spec === null) return dollars(50)
  const budget = configOf(spec.policies, trade)?.dailyBudget ?? dollars(50)
  const largest = configOf(spec.policies, tradeSize)?.maxPerTrade ?? budget
  const most = largest < budget ? largest : budget
  return most < dollars(50) ? Usdc.make(most) : dollars(50)
}

/** The draft each kind of the cast's automations is, for an agent with `spec` (`null`: your own trades). */
export const castDraft = (cast: CastAutomation, spec: AgentSpec | null): AutomationDraft => {
  const symbol = symbolOf(cast.name, spec)
  const base = { name: cast.name, agentId: cast.agentId, conditions: [], settings: DEFAULT_SETTINGS }

  switch (cast.kind) {
    case "weeklyBuy":
      return new AutomationDraft({
        ...base,
        trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
        action: { type: "buy", config: { amount: buyAmount(spec), split: [{ symbol, weight: 10_000 }] } },
        settings: cast.state === "done" ? { ...DEFAULT_SETTINGS, maxFires: 1 } : DEFAULT_SETTINGS
      })
    case "stopLoss":
      return new AutomationDraft({
        ...base,
        trigger: { type: "priceMove", config: { symbol, reference: "trailingHigh", bps: 1000, direction: "down" } },
        conditions: [{ type: "holdingAtLeast", config: { symbol, shares: Shares.make(BigInt(0)) } }],
        action: { type: "sellShare", config: { symbol, bps: 5000 } },
        settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 24 * 60 }
      })
    case "rebalance":
      return new AutomationDraft({
        ...base,
        trigger: { type: "drift", config: {} },
        action: cast.asks ?
          { type: "ask", config: { trade: { type: "rebalance", config: {} } } } :
          { type: "rebalance", config: {} },
        settings: { ...DEFAULT_SETTINGS, quietHours: { from: "22:00", to: "07:00", timeZone: "America/New_York" } }
      })
    case "newsSell":
      return new AutomationDraft({
        ...base,
        trigger: { type: "news", config: { symbols: [symbol], topics: [] } },
        conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }],
        action: { type: "sellShare", config: { symbol, bps: 2500 } },
        settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 6 * 60, actDirectly: !cast.asks }
      })
    case "priceAlert":
      return new AutomationDraft({
        ...base,
        trigger: {
          type: "priceCross",
          config: { symbol, level: Price.make(BigInt(200) * BigInt(100_000_000)), direction: "below" }
        },
        action: { type: "notify", config: { message: `${stockName(symbol)} is under $200, worth a look` } },
        settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 24 * 60 }
      })
    case "monthlySplit": {
      const stocks = spec === null ? [] : configOf(spec.policies, trade)?.stocks ?? []
      const picked = stocks.length >= 3 ? stocks.slice(0, 3) : ["NVDA", "AAPL", "MSFT"] as const
      return new AutomationDraft({
        ...base,
        trigger: { type: "schedule", config: { days: ["friday"], time: "15:30", timeZone: "America/New_York" } },
        conditions: [{ type: "marketOpen", config: {} }],
        action: {
          type: "buy",
          config: {
            amount: dollars(100),
            split: [
              { symbol: picked[0]!, weight: 5000 },
              { symbol: picked[1]!, weight: 3000 },
              { symbol: picked[2]!, weight: 2000 }
            ]
          }
        }
      })
    }
  }
}

/** A saved automation from a draft. */
export const savedAutomation = (options: {
  readonly id: AutomationId
  readonly draft: AutomationDraft
  readonly status: AutomationStatus
  readonly createdBy: Automation["createdBy"]
  readonly createdAt: DateTime.Utc
  readonly now: DateTime.Utc
  readonly requestKey: string | null
}): AutomationRecord => ({
  automation: automationOf({
    id: options.id,
    name: options.draft.name.trim(),
    agentId: options.draft.agentId as AgentId | null,
    trigger: options.draft.trigger,
    conditions: options.draft.conditions,
    action: options.draft.action,
    settings: options.draft.settings as Settings,
    status: options.status,
    fires: 0,
    lastFiredAt: null,
    createdBy: options.createdBy,
    createdFrom: null,
    createdAt: options.createdAt,
    updatedAt: options.createdAt
  }, options.now),
  runs: [],
  judgments: [],
  requestKey: options.requestKey
})

/** Counts its runs that fired (a skipped one didn't), and its last. */
export const countFires = (record: AutomationRecord, now: DateTime.Utc) => {
  const fired = record.runs.filter((run) => run.outcome !== "skipped")
  saveAutomation(record, {
    fires: fired.length,
    lastFiredAt: fired[0]?.firedAt ?? null,
    updatedAt: record.automation.updatedAt
  }, now)
}

/** The states the panel can put an automation in. */
export const AUTOMATION_STATES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
  { value: "expired", label: "Expired" },
  { value: "failing", label: "Failing" }
] as const

export type AutomationState = (typeof AUTOMATION_STATES)[number]["value"]

/** The state the panel shows it in: failing is active with its last run failed. */
export const automationStateOf = (record: AutomationRecord): AutomationState => {
  const status = record.automation.status
  if (status === "active" && record.runs[0]?.outcome === "failed") return "failing"
  return status === "deleted" ? "done" : status
}

/** Sets its status; an expired one says until when, a done one that it fired as often as it may. */
export const setAutomationStatus = (
  record: AutomationRecord,
  state: Exclude<AutomationState, "failing">,
  now: DateTime.Utc
) => {
  const settings = record.automation.settings
  saveAutomation(record, {
    status: state,
    settings: state === "expired" ?
      { ...settings, expiresAt: DateTime.subtract(now, { days: 1 }) } :
      state === "done" ?
      { ...settings, maxFires: Math.max(1, record.automation.fires) } :
      settings
  }, now)
}
