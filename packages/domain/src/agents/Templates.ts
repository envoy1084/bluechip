/**
 * The kinds of agent you can hire, the ranges their limits may take, and three presets to start from, so nobody
 * faces a page of sliders first.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import { type AgentMode, Limits, type Target } from "./Limits.ts"

/**
 * The agents bluechip offers: a Rebalancer keeps your target mix, a Stock picker trades a few stocks both ways, a
 * Weekly buyer buys on a schedule, and a Stop-loss guard only sells.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Template = Schema.Literals(["rebalancer", "stockPicker", "weeklyBuyer", "stopLossGuard"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Template = typeof Template.Type

/**
 * What a template fixes and what it starts from.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface TemplateSpec {
  readonly mode: AgentMode
  /** The most it may spend a day; 0 for a template that never buys. */
  readonly maxDailyBudget: Usdc
  readonly tradesPerDay: number
  readonly tradeWhilePaused: boolean
  /** Whether you may turn on trading while prices are paused: never for a Rebalancer, whose weights need live prices. */
  readonly pausedTradingAllowed: boolean
}

const dollars = (amount: number) => Usdc.make(BigInt(amount) * BigInt(1_000_000))

/**
 * Each template's mode, ceiling and defaults.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const TEMPLATES: Readonly<Record<Template, TemplateSpec>> = {
  rebalancer: {
    mode: "rebalance",
    maxDailyBudget: dollars(2000),
    tradesPerDay: 6,
    tradeWhilePaused: false,
    pausedTradingAllowed: false
  },
  stockPicker: {
    mode: "both",
    maxDailyBudget: dollars(2000),
    tradesPerDay: 12,
    tradeWhilePaused: true,
    pausedTradingAllowed: true
  },
  weeklyBuyer: {
    mode: "buy",
    maxDailyBudget: dollars(500),
    tradesPerDay: 1,
    tradeWhilePaused: true,
    pausedTradingAllowed: true
  },
  stopLossGuard: {
    mode: "sell",
    maxDailyBudget: dollars(0),
    tradesPerDay: 4,
    tradeWhilePaused: true,
    pausedTradingAllowed: true
  }
}

/**
 * The range each number limit accepts, whatever the template.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const BOUNDS = {
  dailyBudget: { min: dollars(0), max: dollars(2000) },
  maxPerTrade: { min: dollars(10), max: dollars(1000) },
  askAbove: { min: dollars(0), max: dollars(1000) },
  maxInOneStock: { min: 500, max: 10_000 },
  cashReserve: { min: 0, max: 5000 },
  tradesPerDay: { min: 1, max: 48 }
} as const

/**
 * The three starting points.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Preset = Schema.Literals(["conservative", "balanced", "active"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Preset = typeof Preset.Type

/**
 * The number limits a preset sets.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PresetLimits {
  readonly dailyBudget: Usdc
  readonly maxPerTrade: Usdc
  readonly askAbove: Usdc
  readonly maxInOneStock: number
  readonly cashReserve: number
}

/**
 * Small and careful, the one most people start with, and more room that is still capped.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PRESETS: Readonly<Record<Preset, PresetLimits>> = {
  conservative: {
    dailyBudget: dollars(100),
    maxPerTrade: dollars(50),
    askAbove: dollars(50),
    maxInOneStock: 2000,
    cashReserve: 2000
  },
  balanced: {
    dailyBudget: dollars(250),
    maxPerTrade: dollars(100),
    askAbove: dollars(150),
    maxInOneStock: 3000,
    cashReserve: 1000
  },
  active: {
    dailyBudget: dollars(1000),
    maxPerTrade: dollars(400),
    askAbove: dollars(500),
    maxInOneStock: 4000,
    cashReserve: 500
  }
}

/**
 * A template's limits from a preset, with the stocks (and, for a Rebalancer, the target mix) you picked. The daily
 * budget never passes the template's ceiling, and the safety settings start at their standard values.
 *
 * **Example** (A balanced Weekly buyer)
 *
 * ```ts import.meta.vitest
 * import { draftLimits } from "@bluechip/domain/agents/Templates"
 *
 * const limits = draftLimits({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: [] })
 * limits.mode // => "buy"
 * limits.dailyBudget // => 500000000n
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const draftLimits = (options: {
  readonly template: Template
  readonly preset: Preset
  readonly stocks: ReadonlyArray<StockSymbol>
  readonly targets: ReadonlyArray<Target>
}): Limits => {
  const spec = TEMPLATES[options.template]
  const preset = PRESETS[options.preset]

  return new Limits({
    stocks: options.stocks,
    mode: spec.mode,
    dailyBudget: Usdc.make(preset.dailyBudget < spec.maxDailyBudget ? preset.dailyBudget : spec.maxDailyBudget),
    maxPerTrade: preset.maxPerTrade,
    askAbove: preset.askAbove,
    maxInOneStock: preset.maxInOneStock,
    cashReserve: preset.cashReserve,
    targets: spec.mode === "rebalance" ? options.targets : [],
    tradesPerDay: spec.tradesPerDay,
    priceProtection: 100,
    weeklySlippage: 100,
    rebalanceTrigger: 500,
    tradeWhilePaused: spec.tradeWhilePaused
  })
}
