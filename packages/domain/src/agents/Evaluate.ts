/**
 * Judging an agent's trade against its limits, before anything is signed: allowed, needs your Face ID, blocked by a
 * named rule, or waiting for tomorrow's budget. The same rules hold onchain: what can be called and how much in
 * bluechip's validation policy, prices and the portfolio in its execution policy.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { type Price, Shares, sharesFor, Usdc, valueOf } from "../market/Units.ts"
import { type Limits, LIVE_PRICE_SECONDS, MIN_TRADE, PAUSED_PRICE_SECONDS } from "./Limits.ts"
import { type RebalanceBreach, rebalanceBreaches } from "./Rebalance.ts"
import {
  type Holdings,
  isAtMostBps,
  isWithinCollar,
  type SlippageLedger,
  slippageUsed,
  valueHoldings
} from "./TradeMath.ts"

/**
 * One swap: USDC for a stock (`buy`) or a stock for USDC (`sell`), with what goes in and what comes out (the quote
 * before a trade, the fill after it).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Leg {
  readonly symbol: StockSymbol
  readonly side: "buy" | "sell"
  readonly amountIn: bigint
  readonly amountOut: bigint
}

/**
 * A stock's Chainlink price and how old it is, in seconds.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface FeedPrice {
  readonly price: Price
  readonly ageSeconds: number
}

/**
 * What an agent has used: today's buys and operations, and its slippage ledger.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Usage {
  readonly spentToday: Usdc
  readonly tradesToday: number
  readonly slippage: SlippageLedger
}

/**
 * Everything a decision depends on.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Proposal {
  readonly limits: Limits
  readonly holdings: Holdings
  readonly prices: Readonly<Partial<Record<StockSymbol, FeedPrice>>>
  readonly usage: Usage
  readonly legs: ReadonlyArray<Leg>
  readonly now: DateTime.Utc
}

/**
 * The rules a trade can break.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Rule = Schema.Literals([
  "nothingToTrade",
  "notAllowedStock",
  "wrongDirection",
  "tooSmall",
  "overTradeSize",
  "overDailyBudget",
  "pricesStale",
  "pausedTradingOff",
  "unfairPrice",
  "insufficientBalance",
  "overStockCap",
  "underCashReserve",
  "overSlippageBudget",
  "notNeeded",
  "wrongWay",
  "overshoots",
  "noProgress",
  "losesValue"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Rule = typeof Rule.Type

/**
 * A broken rule, the stock it is about (when it is about one) and a sentence saying what happened.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Violation extends Schema.Class<Violation>("@bluechip/domain/agents/Evaluate/Violation")({
  rule: Rule,
  symbol: Schema.NullOr(StockSymbol),
  message: Schema.String
}) {}

/**
 * The trade fits every limit.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Allowed extends Schema.TaggedClass<Allowed>("@bluechip/domain/agents/Evaluate/Allowed")("Allowed", {
  /** What the trade loses to prices against Chainlink, for the slippage ledger. */
  loss: Usdc
}) {}

/**
 * The trade fits, but it is over the agent's "ask me above" amount: it waits for your Face ID.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class NeedsApproval
  extends Schema.TaggedClass<NeedsApproval>("@bluechip/domain/agents/Evaluate/NeedsApproval")("NeedsApproval", {
    loss: Usdc
  })
{}

/**
 * The trade breaks one or more rules and never runs.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Blocked extends Schema.TaggedClass<Blocked>("@bluechip/domain/agents/Evaluate/Blocked")("Blocked", {
  violations: Schema.Array(Violation)
}) {}

/**
 * The trade fits, but today's budget or trade count is used up: it can run from `until` (the next UTC day).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Wait extends Schema.TaggedClass<Wait>("@bluechip/domain/agents/Evaluate/Wait")("Wait", {
  reason: Schema.Literals(["dailyBudget", "tradesPerDay"]),
  until: Schema.DateTimeUtc
}) {}

/**
 * What happens to a proposed trade.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const Decision = Schema.Union([Allowed, NeedsApproval, Blocked, Wait])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Decision = typeof Decision.Type

/**
 * How trustworthy a stock's price is: `live`, `paused` (weekends and holidays) or `stale` (nothing trades on it).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PriceMode = "live" | "paused" | "stale"

/**
 * A price's mode from its age.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const priceMode = (ageSeconds: number): PriceMode =>
  ageSeconds <= LIVE_PRICE_SECONDS ? "live" : ageSeconds <= PAUSED_PRICE_SECONDS ? "paused" : "stale"

/**
 * The collar a trade gets: the agent's price protection while prices are live, half of it while they are paused.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const collarFor = (limits: Limits, mode: PriceMode): number =>
  mode === "paused" ? limits.priceProtection / 2 : limits.priceProtection

/**
 * What a leg is worth in dollars at Chainlink's price: the USDC in for a buy, the shares in valued for a sell.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const legValue = (leg: Leg, price: Price): Usdc =>
  leg.side === "buy" ? Usdc.make(leg.amountIn) : valueOf(Shares.make(leg.amountIn), price)

/**
 * What a leg loses against Chainlink's price, never negative: a buy's USDC less its shares' value, a sell's shares'
 * value less its USDC.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const legLoss = (leg: Leg, price: Price): Usdc => {
  const loss = leg.side === "buy" ?
    leg.amountIn - valueOf(Shares.make(leg.amountOut), price) :
    valueOf(Shares.make(leg.amountIn), price) - leg.amountOut
  return Usdc.make(loss > BigInt(0) ? loss : BigInt(0))
}

const REBALANCE_MESSAGES: Readonly<Record<RebalanceBreach["rule"], (asset: string) => string>> = {
  notNeeded: () => "Your portfolio is already close to its target mix.",
  wrongWay: (asset) => `${asset} would move away from its target.`,
  overshoots: (asset) => `${asset} would go past its target.`,
  noProgress: () => "This wouldn't bring your portfolio closer to its target mix.",
  losesValue: () => "This would cost your portfolio more than the price protection allows."
}

const nextUtcDay = (now: DateTime.Utc): DateTime.Utc => DateTime.add(DateTime.startOf(now, "day"), { days: 1 })

const dollars = (amount: bigint): string => `$${(Number(amount) / 1_000_000).toFixed(2)}`

/**
 * The holdings after `legs`, or `undefined` when the account doesn't hold enough for them.
 *
 * @stability unstable
 * @category valuation
 * @since 0.0.0
 */
export const holdingsAfter = (holdings: Holdings, legs: ReadonlyArray<Leg>): Holdings | undefined => {
  let usdc = holdings.usdc as bigint
  const shares: Partial<Record<StockSymbol, bigint>> = { ...holdings.shares }

  for (const leg of legs) {
    const held = shares[leg.symbol] ?? BigInt(0)
    if (leg.side === "buy") {
      usdc -= leg.amountIn
      shares[leg.symbol] = held + leg.amountOut
    } else {
      usdc += leg.amountOut
      shares[leg.symbol] = held - leg.amountIn
    }
    if (usdc < BigInt(0) || shares[leg.symbol]! < BigInt(0)) return undefined
  }

  return {
    usdc: Usdc.make(usdc),
    shares: Object.fromEntries(Object.entries(shares).map(([symbol, amount]) => [symbol, Shares.make(amount)]))
  }
}

/**
 * Checks `legs` (one operation of an agent) against its limits, prices and usage. Every broken rule is reported, so
 * the agent's page can name each one.
 *
 * @stability unstable
 * @category evaluation
 * @since 0.0.0
 */
export const evaluate = (proposal: Proposal): Decision => {
  const { holdings, legs, limits, prices, usage } = proposal
  const violations: Array<Violation> = []
  const violate = (rule: Rule, symbol: StockSymbol | null, message: string) =>
    violations.push(new Violation({ rule, symbol, message }))

  if (legs.length === 0 || legs.some((leg) => leg.amountIn <= BigInt(0))) {
    violate("nothingToTrade", null, "There's nothing to trade.")
    return new Blocked({ violations })
  }

  // Validation: what may be traded, which way, and how much.
  let buys = BigInt(0)
  let needsApproval = false

  for (const leg of legs) {
    if (!limits.stocks.includes(leg.symbol)) {
      violate("notAllowedStock", leg.symbol, `This agent can't trade ${leg.symbol}.`)
    }
    if ((limits.mode === "buy" && leg.side === "sell") || (limits.mode === "sell" && leg.side === "buy")) {
      violate("wrongDirection", leg.symbol, `This agent can only ${limits.mode}.`)
    }
    if (leg.side === "buy") buys += leg.amountIn
  }

  if (buys > limits.dailyBudget) {
    violate("overDailyBudget", null, `That's more than the daily budget of ${dollars(limits.dailyBudget)}.`)
  }

  // Execution: prices, what was received, and the portfolio afterwards.
  let loss = BigInt(0)
  const reference: Partial<Record<StockSymbol, Price>> = {}

  for (const leg of legs) {
    const feed = prices[leg.symbol]
    const mode = feed === undefined ? "stale" : priceMode(feed.ageSeconds)
    if (feed === undefined || mode === "stale") {
      violate("pricesStale", leg.symbol, `${leg.symbol}'s price is too old to trade on.`)
      continue
    }
    if (mode === "paused" && (!limits.tradeWhilePaused || limits.mode === "rebalance")) {
      violate("pausedTradingOff", leg.symbol, "This agent doesn't trade while prices are paused.")
    }
    reference[leg.symbol] = feed.price

    const value = legValue(leg, feed.price)
    if (value < MIN_TRADE) violate("tooSmall", leg.symbol, `Trades start at ${dollars(MIN_TRADE)}.`)
    if (value > limits.maxPerTrade) {
      violate("overTradeSize", leg.symbol, `That's more than ${dollars(limits.maxPerTrade)} in one trade.`)
    }
    if (value > limits.askAbove) needsApproval = true

    const fair = leg.side === "buy" ?
      sharesFor(Usdc.make(leg.amountIn), feed.price) :
      valueOf(Shares.make(leg.amountIn), feed.price)
    if (!isWithinCollar(leg.amountOut, fair, collarFor(limits, mode))) {
      violate("unfairPrice", leg.symbol, `${leg.symbol}'s price is too far from Chainlink's.`)
    }
    loss += legLoss(leg, feed.price)
  }

  const after = holdingsAfter(holdings, legs)
  if (after === undefined) {
    violate("insufficientBalance", null, "The account doesn't hold enough for this trade.")
    return new Blocked({ violations })
  }

  // Every holding needs a usable price to value the portfolio; the legs' stocks were checked above.
  const held = (Object.keys({ ...holdings.shares, ...after.shares }) as Array<StockSymbol>).filter(
    (symbol) => (holdings.shares[symbol] ?? BigInt(0)) > BigInt(0) || (after.shares[symbol] ?? BigInt(0)) > BigInt(0)
  )
  for (const symbol of held) {
    const feed = prices[symbol]
    if (reference[symbol] !== undefined) continue
    if (feed === undefined || priceMode(feed.ageSeconds) === "stale") {
      if (!violations.some((v) => v.rule === "pricesStale" && v.symbol === symbol)) {
        violate("pricesStale", symbol, `${symbol}'s price is too old to value your portfolio.`)
      }
      continue
    }
    reference[symbol] = feed.price
  }
  if (violations.some((violation) => violation.rule === "pricesStale")) return new Blocked({ violations })

  const before = valueHoldings(holdings, reference)
  const valued = valueHoldings(after, reference)

  for (const symbol of new Set(legs.map((leg) => leg.symbol))) {
    const grew = (after.shares[symbol] ?? BigInt(0)) > (holdings.shares[symbol] ?? BigInt(0))
    if (grew && !isAtMostBps(valued.values.get(symbol) ?? BigInt(0), valued.total, limits.maxInOneStock)) {
      violate("overStockCap", symbol, `${symbol} would be over ${limits.maxInOneStock / 100}% of your money.`)
    }
  }
  if (after.usdc < holdings.usdc && after.usdc * BigInt(10_000) < BigInt(limits.cashReserve) * valued.total) {
    violate("underCashReserve", null, `Cash would fall under ${limits.cashReserve / 100}% of your money.`)
  }

  if (limits.mode === "rebalance") {
    const moved = [...new Set(legs.map((leg) => leg.symbol))]
    for (const breach of rebalanceBreaches({ limits, before, after: valued, moved })) {
      const symbol = breach.asset === null || breach.asset === "USDC" ? null : breach.asset
      violate(breach.rule, symbol, REBALANCE_MESSAGES[breach.rule](breach.asset ?? "your portfolio"))
    }
  }

  const budget = (BigInt(limits.weeklySlippage) * before.total) / BigInt(10_000)
  const now = Number(DateTime.toEpochMillis(proposal.now) / 1000)
  if (slippageUsed(usage.slippage, Math.floor(now)) + loss > budget) {
    violate("overSlippageBudget", null, "This agent has lost its weekly allowance to prices.")
  }

  if (violations.length > 0) return new Blocked({ violations })

  if (usage.spentToday + buys > limits.dailyBudget) {
    return new Wait({ reason: "dailyBudget", until: nextUtcDay(proposal.now) })
  }
  if (usage.tradesToday + 1 > limits.tradesPerDay) {
    return new Wait({ reason: "tradesPerDay", until: nextUtcDay(proposal.now) })
  }

  return needsApproval ? new NeedsApproval({ loss: Usdc.make(loss) }) : new Allowed({ loss: Usdc.make(loss) })
}
