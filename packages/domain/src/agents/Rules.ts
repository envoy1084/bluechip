/**
 * Reading limits: whether they can be locked, whether a change is tighter (it applies at once) or looser (it needs
 * Face ID), and what they allow, said as sentences.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import type { Usdc } from "../market/Units.ts"
import type { Limits } from "./Limits.ts"
import { BOUNDS, type Template, TEMPLATES } from "./Templates.ts"

/**
 * The parts of limits a problem or a change is about.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const LimitField = Schema.Literals([
  "stocks",
  "mode",
  "dailyBudget",
  "maxPerTrade",
  "askAbove",
  "maxInOneStock",
  "cashReserve",
  "targets",
  "tradesPerDay",
  "priceProtection",
  "weeklySlippage",
  "rebalanceTrigger",
  "tradeWhilePaused"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type LimitField = typeof LimitField.Type

/**
 * Why limits can't be locked, said as a sentence about one field.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class LimitProblem extends Schema.Class<LimitProblem>("@bluechip/domain/agents/Rules/LimitProblem")({
  field: LimitField,
  message: Schema.String
}) {}

const dollarFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

const formatDollars = (amount: Usdc): string => dollarFormat.format(Number(amount / BigInt(1_000_000)))

const formatPercent = (bps: number): string => `${bps / 100}%`

/**
 * Every reason `limits` can't be locked for `template`; empty when they can.
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const validate = (limits: Limits, template: Template): ReadonlyArray<LimitProblem> => {
  const spec = TEMPLATES[template]
  const problems: Array<LimitProblem> = []
  const problem = (field: LimitField, message: string) => problems.push(new LimitProblem({ field, message }))

  if (limits.mode !== spec.mode) problem("mode", "This agent can't trade that way.")
  if (limits.stocks.length === 0) problem("stocks", "Pick at least one stock.")
  if (new Set(limits.stocks).size !== limits.stocks.length) problem("stocks", "Each stock can be picked once.")

  const ceiling = spec.maxDailyBudget < BOUNDS.dailyBudget.max ? spec.maxDailyBudget : BOUNDS.dailyBudget.max
  if (limits.dailyBudget > ceiling) {
    problem(
      "dailyBudget",
      ceiling === BigInt(0) ? "This agent never buys." : `Pick at most ${formatDollars(ceiling)} a day.`
    )
  }

  const dollarFields = ["maxPerTrade", "askAbove"] as const
  for (const field of dollarFields) {
    const { max, min } = BOUNDS[field]
    if (limits[field] < min || limits[field] > max) {
      problem(field, `Pick ${formatDollars(min)} to ${formatDollars(max)}.`)
    }
  }
  if (limits.dailyBudget > BigInt(0) && limits.maxPerTrade > limits.dailyBudget) {
    problem("maxPerTrade", `Can't be more than the daily budget (${formatDollars(limits.dailyBudget)}).`)
  }

  const percentFields = ["maxInOneStock", "cashReserve"] as const
  for (const field of percentFields) {
    const { max, min } = BOUNDS[field]
    if (limits[field] < min || limits[field] > max) {
      problem(field, `Pick ${formatPercent(min)} to ${formatPercent(max)}.`)
    }
  }
  if (limits.maxInOneStock + limits.cashReserve > 10_000) {
    problem("cashReserve", "Cash reserve plus max in one stock can't pass 100%.")
  }

  const { max: maxTrades, min: minTrades } = BOUNDS.tradesPerDay
  if (!Number.isInteger(limits.tradesPerDay) || limits.tradesPerDay < minTrades || limits.tradesPerDay > maxTrades) {
    problem("tradesPerDay", `Pick ${minTrades} to ${maxTrades} trades a day.`)
  }

  if (limits.tradeWhilePaused && !spec.pausedTradingAllowed) {
    problem("tradeWhilePaused", "A Rebalancer only trades while prices are live.")
  }

  problems.push(...targetProblems(limits))
  return problems
}

const targetProblems = (limits: Limits): ReadonlyArray<LimitProblem> => {
  const problem = (message: string) => [new LimitProblem({ field: "targets", message })]

  if (limits.mode !== "rebalance") {
    return limits.targets.length === 0 ? [] : problem("Only a Rebalancer has a target mix.")
  }
  if (limits.targets.length === 0) return problem("Set a target mix.")

  const assets = limits.targets.map((target) => target.asset)
  if (new Set(assets).size !== assets.length) return problem("Each stock can appear once in the mix.")
  if (limits.stocks.some((symbol) => !assets.includes(symbol))) return problem("Give every stock a target.")
  if (assets.some((asset) => asset !== "USDC" && !limits.stocks.includes(asset))) {
    return problem("The mix can only hold the stocks this agent trades, and cash.")
  }
  if (limits.targets.some((target) => !Number.isInteger(target.weight) || target.weight < 0)) {
    return problem("Targets can't be negative.")
  }
  if (limits.targets.reduce((sum, target) => sum + target.weight, 0) !== 10_000) {
    return problem("The mix has to add up to 100%.")
  }
  if (limits.targets.some((target) => target.asset !== "USDC" && target.weight > limits.maxInOneStock)) {
    return problem(`No stock's target can pass the max in one stock (${formatPercent(limits.maxInOneStock)}).`)
  }

  const cash = limits.targets.find((target) => target.asset === "USDC")?.weight ?? 0
  return cash < limits.cashReserve ?
    problem(`Cash's target can't be under the cash reserve (${formatPercent(limits.cashReserve)}).`) :
    []
}

/**
 * How a change compares with the limits in force: `tighter` applies at once, `looser` needs Face ID.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type LimitChange = "same" | "tighter" | "looser"

/**
 * A change, field by field and as a whole (looser if any field is).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface LimitChanges {
  readonly overall: LimitChange
  readonly fields: Readonly<Record<LimitField, LimitChange>>
}

// Which way each number limit is tighter: a lower budget, or a higher cash reserve.
const TIGHTER_WHEN = {
  dailyBudget: "lower",
  maxPerTrade: "lower",
  askAbove: "lower",
  maxInOneStock: "lower",
  cashReserve: "higher",
  tradesPerDay: "lower",
  priceProtection: "lower",
  weeklySlippage: "lower",
  rebalanceTrigger: "higher"
} as const

const compareNumbers = (before: number | bigint, after: number | bigint, tighter: "lower" | "higher"): LimitChange => {
  if (before === after) return "same"
  return (after < before) === (tighter === "lower") ? "tighter" : "looser"
}

const compareStocks = (before: ReadonlyArray<StockSymbol>, after: ReadonlyArray<StockSymbol>): LimitChange => {
  if (after.some((symbol) => !before.includes(symbol))) return "looser"
  return before.some((symbol) => !after.includes(symbol)) ? "tighter" : "same"
}

const sameTargets = (before: Limits, after: Limits): boolean =>
  before.targets.length === after.targets.length &&
  before.targets.every((target) =>
    after.targets.some((other) => other.asset === target.asset && other.weight === target.weight)
  )

/**
 * How `after` compares with `before`. A new target mix always counts as looser: it lets the agent trade toward
 * weights you haven't agreed to yet.
 *
 * **Example** (Lowering the daily budget)
 *
 * ```ts import.meta.vitest
 * import { Limits } from "@bluechip/domain/agents/Limits"
 * import { compare } from "@bluechip/domain/agents/Rules"
 * import { draftLimits } from "@bluechip/domain/agents/Templates"
 * import { Usdc } from "@bluechip/domain/market/Units"
 *
 * const before = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * const after = new Limits({ ...before, dailyBudget: Usdc.make(100_000_000n) })
 * compare(before, after).overall // => "tighter"
 * ```
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const compare = (before: Limits, after: Limits): LimitChanges => {
  const fields: Record<LimitField, LimitChange> = {
    stocks: compareStocks(before.stocks, after.stocks),
    mode: before.mode === after.mode ? "same" : "looser",
    targets: sameTargets(before, after) ? "same" : "looser",
    tradeWhilePaused: before.tradeWhilePaused === after.tradeWhilePaused ?
      "same" :
      after.tradeWhilePaused ?
      "looser" :
      "tighter",
    dailyBudget: compareNumbers(before.dailyBudget, after.dailyBudget, TIGHTER_WHEN.dailyBudget),
    maxPerTrade: compareNumbers(before.maxPerTrade, after.maxPerTrade, TIGHTER_WHEN.maxPerTrade),
    askAbove: compareNumbers(before.askAbove, after.askAbove, TIGHTER_WHEN.askAbove),
    maxInOneStock: compareNumbers(before.maxInOneStock, after.maxInOneStock, TIGHTER_WHEN.maxInOneStock),
    cashReserve: compareNumbers(before.cashReserve, after.cashReserve, TIGHTER_WHEN.cashReserve),
    tradesPerDay: compareNumbers(before.tradesPerDay, after.tradesPerDay, TIGHTER_WHEN.tradesPerDay),
    priceProtection: compareNumbers(before.priceProtection, after.priceProtection, TIGHTER_WHEN.priceProtection),
    weeklySlippage: compareNumbers(before.weeklySlippage, after.weeklySlippage, TIGHTER_WHEN.weeklySlippage),
    rebalanceTrigger: compareNumbers(before.rebalanceTrigger, after.rebalanceTrigger, TIGHTER_WHEN.rebalanceTrigger)
  }

  const changes = Object.values(fields)
  const overall = changes.includes("looser") ? "looser" : changes.includes("tighter") ? "tighter" : "same"
  return { overall, fields }
}

/**
 * What an agent can do, and what it can never do.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Description {
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
}

const listNames = (names: ReadonlyArray<string>): string => {
  if (names.length <= 1) return names[0] ?? "no stocks"
  if (names.length > 3) return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/**
 * `limits` as sentences, naming stocks with `name` (the company's name).
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describe = (limits: Limits, name: (symbol: StockSymbol) => string): Description => {
  const stocks = listNames(limits.stocks.map(name))
  const trade = {
    rebalance: `Trade ${stocks}, only to move you back to your target mix`,
    buy: `Buy ${stocks}`,
    sell: `Sell ${stocks}`,
    both: `Buy and sell ${stocks}`
  }[limits.mode]

  const can = [
    trade,
    ...(limits.dailyBudget > BigInt(0) ? [`Spend up to ${formatDollars(limits.dailyBudget)} a day`] : []),
    `Trade up to ${formatDollars(limits.maxPerTrade)} at a time, ${limits.tradesPerDay} times a day at most`,
    limits.askAbove > BigInt(0) ?
      `Ask you before trades over ${formatDollars(limits.askAbove)}` :
      "Ask you before every trade",
    ...(limits.tradeWhilePaused ? ["Trade on weekends and holidays, with a tighter price limit"] : [])
  ]

  const never = [
    "Send money out of your account",
    ...(limits.maxInOneStock < 10_000 ?
      [`Put over ${formatPercent(limits.maxInOneStock)} of your money in one stock`] :
      []),
    ...(limits.cashReserve > 0 ? [`Leave less than ${formatPercent(limits.cashReserve)} in cash`] : []),
    `Trade more than ${formatPercent(limits.priceProtection)} away from Chainlink's price`,
    `Lose more than ${formatPercent(limits.weeklySlippage)} of your money to prices in a week`,
    ...(limits.tradeWhilePaused ? [] : ["Trade while prices are paused"]),
    "Change its own limits"
  ]

  return { can, never }
}
