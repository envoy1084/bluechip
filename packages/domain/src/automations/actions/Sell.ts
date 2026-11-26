/**
 * The `sell` and `sellShare` actions: sell a dollar amount of a stock, or a share of what you hold of it. Never
 * more than you hold.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { Leg } from "../../intents/Intent.ts"
import { StockSymbol } from "../../market/Market.ts"
import { Shares, sharesFor, Usdc } from "../../market/Units.ts"
import { dollars } from "../../policies/Format.ts"
import * as Action from "../Action.ts"
import { directionProblems, stockProblems } from "../AgentLimits.ts"
import { Field } from "../Entry.ts"
import { formatBps, formatUsd } from "../Format.ts"
import { amountProblems } from "./Buy.ts"

/**
 * The stock and the dollars of it to sell (USDC units).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SellConfig = Schema.Struct({ symbol: StockSymbol, amount: Usdc })

/**
 * The stock and the share of the holding to sell, in basis points (10,000: all of it).
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SellShareConfig = Schema.Struct({ symbol: StockSymbol, bps: Schema.Int })

const sellLeg = (symbol: StockSymbol, shares: bigint): ReadonlyArray<Leg> =>
  shares <= BigInt(0) ? [] : [{ symbol, side: "sell", amount: { shares: Shares.make(shares) } }]

const heldOf = (symbol: StockSymbol, context: Action.PlanContext) =>
  context.portfolio.holdings.find((holding) => holding.symbol === symbol)?.shares ?? BigInt(0)

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const sell = Action.make({
  type: "sell",
  title: "Sell",
  summary: "Sells a dollar amount of a stock, never more than you hold.",
  aliases: ["take profit", "trim", "cash out"],
  examples: ["sell $100 of Apple"],
  config: SellConfig,
  fields: {
    symbol: new Field({ label: "Stock", unit: "stock" }),
    amount: new Field({ label: "Amount", unit: "usd", min: Number(dollars(1)), max: Number(dollars(10_000)) })
  },
  defaults: { symbol: "AAPL", amount: Usdc.make(dollars(100)) },
  check: (config, context) => {
    const direction = directionProblems("sell", context)
    if (direction.length > 0) return direction
    return [
      ...stockProblems("symbol", [config.symbol], context),
      ...(config.amount < dollars(1) ? [{ field: "amount", message: "Sell at least $1." }] : []),
      ...amountProblems("sell", [config.amount], context)
    ]
  },
  describe: (config, { name }) => `sell ${formatUsd(config.amount)} of ${name(config.symbol)}`,
  plan: (config, context) => {
    const price = context.prices.get(config.symbol)
    if (price === undefined) return []
    const wanted = sharesFor(config.amount, price)
    const held = heldOf(config.symbol, context)
    return sellLeg(config.symbol, wanted < held ? wanted : held)
  }
})

const SHARES: Readonly<Record<number, string>> = { 10_000: "all", 5000: "half", 2500: "a quarter of" }

/**
 * @stability unstable
 * @category actions
 * @since 0.0.0
 */
export const sellShare = Action.make({
  type: "sellShare",
  title: "Sell part of a holding",
  summary: "Sells a share of what you hold of a stock: half, all of it, or a percentage.",
  aliases: ["sell half", "sell all", "sell everything", "stop loss", "exit"],
  examples: ["sell half your NVIDIA", "sell all of it"],
  config: SellShareConfig,
  fields: {
    symbol: new Field({ label: "Stock", unit: "stock" }),
    bps: new Field({ label: "Share of the holding", unit: "bps", min: 100, max: 10_000, choices: [2500, 5000, 10_000] })
  },
  defaults: { symbol: "NVDA", bps: 5000 },
  check: (config, context) => [
    ...directionProblems("sell", context),
    ...stockProblems("symbol", [config.symbol], context),
    ...(config.bps < 1 || config.bps > 10_000 ? [{ field: "bps", message: "Pick 1% to 100%." }] : [])
  ],
  describe: (config, { name }) => {
    const share = SHARES[config.bps]
    return share === undefined ?
      `sell ${formatBps(config.bps)} of your ${name(config.symbol)}` :
      `sell ${share} your ${name(config.symbol)}`
  },
  plan: (config, context) =>
    sellLeg(config.symbol, (heldOf(config.symbol, context) * BigInt(config.bps)) / BigInt(10_000))
})
