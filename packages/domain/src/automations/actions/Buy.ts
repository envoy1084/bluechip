/**
 * The `buy` action: an amount of dollars split across stocks.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { Leg } from "../../intents/Intent.ts"
import { StockSymbol } from "../../market/Market.ts"
import { Usdc } from "../../market/Units.ts"
import { dollars, formatDollars, listNames } from "../../policies/Format.ts"
import * as Action from "../Action.ts"
import { directionProblems, limitsOf, stockProblems } from "../AgentLimits.ts"
import { type CheckContext, Field, type FieldProblem } from "../Entry.ts"
import { formatBps, formatUsd } from "../Format.ts"

/**
 * One stock's share of a buy, in basis points.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Allocation = Schema.Struct({ symbol: StockSymbol, weight: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Allocation = typeof Allocation.Type

/**
 * The dollars (USDC units) and how they split across stocks (adding up to 10,000 basis points).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const BuyConfig = Schema.Struct({ amount: Usdc, split: Schema.Array(Allocation) })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type BuyConfig = typeof BuyConfig.Type

/**
 * How many trades an amount takes when each may be at most `maxPerTrade`.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const tradesFor = (amount: bigint, maxPerTrade: bigint): number =>
  maxPerTrade <= BigInt(0) ? 1 : Number((amount + maxPerTrade - BigInt(1)) / maxPerTrade)

/**
 * Why the agent's policies could never pass these trades in a day (one amount per stock): over its daily budget
 * (buys), or more trades than it makes a day once each is split into its largest trade.
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const amountProblems = (
  side: "buy" | "sell",
  parts: ReadonlyArray<bigint>,
  context: CheckContext
): ReadonlyArray<FieldProblem> => {
  const limits = limitsOf(context.spec)
  if (limits === null || context.asking === true) return []
  const problems: Array<FieldProblem> = []
  const amount = parts.reduce((sum, part) => sum + part, BigInt(0))
  if (side === "buy" && amount > limits.dailyBudget) {
    problems.push({ field: "amount", message: `Over the agent's daily budget (${formatDollars(limits.dailyBudget)}).` })
  }
  if (limits.maxPerTrade !== null && limits.tradesPerDay !== null) {
    const trades = parts.reduce((sum, part) => sum + tradesFor(part, limits.maxPerTrade!), 0)
    if (trades > limits.tradesPerDay) {
      problems.push({
        field: "amount",
        message: `Takes ${trades} trades of at most ${formatDollars(limits.maxPerTrade)}, more than the agent's ` +
          `${limits.tradesPerDay} a day.`
      })
    }
  }
  return problems
}

const splitProblems = (config: BuyConfig, context: CheckContext): ReadonlyArray<FieldProblem> => {
  const symbols = config.split.map((part) => part.symbol)
  if (symbols.length === 0) return [{ field: "split", message: "Pick at least one stock." }]
  if (new Set(symbols).size !== symbols.length) return [{ field: "split", message: "Pick each stock once." }]
  if (config.split.some((part) => part.weight <= 0)) return [{ field: "split", message: "Give every stock a share." }]
  if (config.split.reduce((sum, part) => sum + part.weight, 0) !== 10_000) {
    return [{ field: "split", message: "The split has to add up to 100%." }]
  }
  const smallest = context.asking === true ? null : limitsOf(context.spec)?.minPerTrade ?? null
  const parts = config.split.map((part) => (config.amount * BigInt(part.weight)) / BigInt(10_000))
  if (smallest !== null && parts.some((part) => part < smallest)) {
    return [{ field: "split", message: `Each stock's part has to be at least ${formatDollars(smallest)}.` }]
  }
  return stockProblems("split", symbols, context)
}

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const buy = Action.make({
  type: "buy",
  title: "Buy",
  summary: "Buys an amount of dollars, split across the stocks you pick.",
  aliases: ["invest", "add to", "purchase", "dollar cost average"],
  examples: ["buy $50 of Apple", "buy $100 split across Apple and NVIDIA"],
  config: BuyConfig,
  fields: {
    amount: new Field({
      label: "Amount",
      unit: "usd",
      min: Number(dollars(1)),
      max: Number(dollars(2000)),
      step: Number(dollars(5)),
      choices: [25, 50, 100].map((amount) => Number(dollars(amount)))
    }),
    split: new Field({ label: "Stocks", unit: "split" })
  },
  defaults: { amount: Usdc.make(dollars(50)), split: [{ symbol: "AAPL", weight: 10_000 }] },
  check: (config, context) => {
    const direction = directionProblems("buy", context)
    if (direction.length > 0) return direction
    return [
      ...(config.amount < dollars(1) ? [{ field: "amount", message: "Buy at least $1." }] : []),
      ...splitProblems(config, context),
      ...amountProblems(
        "buy",
        config.split.map((part) => (config.amount * BigInt(part.weight)) / BigInt(10_000)),
        context
      )
    ]
  },
  describe: (config, { name }) => {
    const amount = formatUsd(config.amount)
    const names = config.split.map((part) => name(part.symbol))
    if (config.split.length === 1) return `buy ${amount} of ${names[0]}`
    const even = config.split.every((part) => Math.abs(part.weight - 10_000 / config.split.length) < 1)
    if (even) return `buy ${amount} split across ${listNames(names)}`
    return `buy ${amount}: ${listNames(config.split.map((part) => `${formatBps(part.weight)} ${name(part.symbol)}`))}`
  },
  plan: (config) => {
    let left = config.amount as bigint
    return config.split.map((part, index): Leg => {
      const usdc = index === config.split.length - 1 ? left : (config.amount * BigInt(part.weight)) / BigInt(10_000)
      left -= usdc
      return { symbol: part.symbol, side: "buy", amount: { usdc: Usdc.make(usdc) } }
    }).filter((leg) => "usdc" in leg.amount && leg.amount.usdc > BigInt(0))
  }
})
