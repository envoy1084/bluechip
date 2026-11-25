/**
 * Shared cases for an agent's rules: each one a portfolio, prices, usage and an operation, with the decision every
 * implementation must reach. bluechip's `evaluate` runs them here; the contracts run the same cases (exported to
 * JSON) so a rule means the same thing offchain and onchain. Expectations are worked out by hand, never generated.
 *
 * Unless a case says otherwise: $1,000 cash, 5 NVDA at $100 and 2.5 AAPL at $200 ($2,000 in all), prices a minute
 * old, nothing used today, and a balanced Stock picker for NVDA and AAPL ($250 a day, $100 a trade, ask above $150,
 * 30% in one stock, 10% cash, 1% price protection, 1% weekly slippage, 12 trades a day). Rebalancer cases target
 * 30% NVDA, 30% AAPL and 40% cash.
 */
import type { Decision, FeedPrice, Leg, Proposal, Rule } from "@bluechip/domain/agents/Evaluate"
import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import * as DateTime from "effect/DateTime"

export interface Vector {
  readonly name: string
  readonly proposal: Proposal
  readonly expected: {
    readonly decision: Decision["_tag"]
    /** Broken rules in order, with the stock when the rule names one: "overStockCap NVDA". */
    readonly rules?: ReadonlyArray<`${Rule}` | `${Rule} ${StockSymbol}`>
    readonly wait?: "dailyBudget" | "tradesPerDay"
  }
}

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))
const shares = (count: number) => Shares.make(BigInt(Math.round(count * 100_000_000)))
const feed = (dollars: number, ageSeconds = 60): FeedPrice => ({
  price: Price.make(BigInt(dollars) * BigInt(100_000_000)),
  ageSeconds
})

const NOW = DateTime.makeUnsafe("2026-11-25T15:00:00Z")
const NOW_SECONDS = Number(DateTime.toEpochMillis(NOW) / 1000)
const HOUR = 3600

const PICKER = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })
const REBALANCER = draftLimits({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

const buy = (symbol: StockSymbol, dollars: number, sharesOut: number): Leg => ({
  symbol,
  side: "buy",
  amountIn: usdc(dollars),
  amountOut: shares(sharesOut)
})

const sell = (symbol: StockSymbol, count: number, dollarsOut: number): Leg => ({
  symbol,
  side: "sell",
  amountIn: shares(count),
  amountOut: usdc(dollarsOut)
})

const held = (cash: number, nvda: number, aapl: number) => ({
  usdc: usdc(cash),
  shares: { NVDA: shares(nvda), AAPL: shares(aapl) }
})

const PRICES = { NVDA: feed(100), AAPL: feed(200), TSLA: feed(400) }

interface CaseInput {
  readonly limits?: Partial<Limits>
  readonly base?: Limits
  readonly holdings?: Proposal["holdings"]
  readonly prices?: Proposal["prices"]
  readonly spentToday?: number
  readonly tradesToday?: number
  readonly slippage?: { readonly used: number; readonly daysAgo?: number }
  readonly legs: ReadonlyArray<Leg>
}

const vector = (name: string, input: CaseInput, expected: Vector["expected"]): Vector => ({
  name,
  proposal: {
    limits: new Limits({ ...(input.base ?? PICKER), ...input.limits }),
    holdings: input.holdings ?? held(1000, 5, 2.5),
    prices: input.prices ?? PRICES,
    usage: {
      spentToday: usdc(input.spentToday ?? 0),
      tradesToday: input.tradesToday ?? 0,
      slippage: {
        used: usdc(input.slippage?.used ?? 0),
        updatedAt: NOW_SECONDS - Math.round((input.slippage?.daysAgo ?? 0) * 86_400)
      }
    },
    legs: input.legs,
    now: NOW
  },
  expected
})

const allowed = { decision: "Allowed" } as const
const approval = { decision: "NeedsApproval" } as const
const blocked = (...rules: NonNullable<Vector["expected"]["rules"]>): Vector["expected"] => ({
  decision: "Blocked",
  rules
})

const pickerVectors: ReadonlyArray<Vector> = [
  // What may be traded, which way.
  vector("a fair buy that lands exactly on the 30% cap", { legs: [buy("NVDA", 100, 1)] }, allowed),
  vector("a fair sell", { legs: [sell("NVDA", 1, 100)] }, allowed),
  vector("an empty operation", { legs: [] }, blocked("nothingToTrade")),
  vector("a buy of nothing", { legs: [buy("NVDA", 0, 0)] }, blocked("nothingToTrade")),
  vector("a stock the agent can't trade", { legs: [buy("TSLA", 50, 0.125)] }, blocked("notAllowedStock TSLA")),
  vector(
    "a stock dropped from the list",
    { limits: { stocks: ["NVDA"] }, legs: [sell("AAPL", 0.25, 50)] },
    blocked("notAllowedStock AAPL")
  ),
  vector(
    "a buy-only agent selling",
    { limits: { mode: "buy" }, legs: [sell("NVDA", 0.5, 50)] },
    blocked("wrongDirection NVDA")
  ),
  vector(
    "a sell-only agent buying",
    { limits: { mode: "sell" }, legs: [buy("NVDA", 50, 0.5)] },
    blocked("wrongDirection NVDA")
  ),
  vector("a sell-only agent selling", { limits: { mode: "sell" }, legs: [sell("NVDA", 1, 100)] }, allowed),
  vector(
    "a sell-only agent with no budget buying",
    { limits: { mode: "sell", dailyBudget: usdc(0) }, legs: [buy("NVDA", 50, 0.5)] },
    blocked("wrongDirection NVDA", "overDailyBudget")
  ),

  // How big.
  vector("a buy under $5", { legs: [buy("NVDA", 4.99, 0.0499)] }, blocked("tooSmall NVDA")),
  vector("a $5 buy", { legs: [buy("NVDA", 5, 0.05)] }, allowed),
  vector(
    "a buy over the max per trade",
    { limits: { maxInOneStock: 5000 }, legs: [buy("AAPL", 101, 0.505)] },
    blocked("overTradeSize AAPL")
  ),
  vector("a sell worth over the max per trade", { legs: [sell("NVDA", 1.01, 101)] }, blocked("overTradeSize NVDA")),
  vector("a sell worth exactly the max per trade", { legs: [sell("NVDA", 1, 100)] }, allowed),
  vector("a buy over ask-me", { limits: { askAbove: usdc(50) }, legs: [buy("NVDA", 60, 0.6)] }, approval),
  vector("a buy at ask-me", { limits: { askAbove: usdc(50) }, legs: [buy("NVDA", 50, 0.5)] }, allowed),
  vector("any trade when ask-me is zero", { limits: { askAbove: usdc(0) }, legs: [buy("NVDA", 5, 0.05)] }, approval),
  vector("a sell over ask-me", { limits: { askAbove: usdc(50) }, legs: [sell("NVDA", 0.6, 60)] }, approval),

  // Budget and count.
  vector(
    "an operation over the daily budget",
    {
      limits: { maxInOneStock: 5000 },
      legs: [buy("NVDA", 100, 1), buy("AAPL", 100, 0.5), buy("NVDA", 100, 1)]
    },
    blocked("overDailyBudget")
  ),
  vector("a buy past today's budget", { spentToday: 200, legs: [buy("NVDA", 100, 1)] }, {
    decision: "Wait",
    wait: "dailyBudget"
  }),
  vector("a buy that uses today's budget exactly", { spentToday: 150, legs: [buy("NVDA", 100, 1)] }, allowed),
  vector("a sell after today's budget is spent", { spentToday: 250, legs: [sell("NVDA", 1, 100)] }, allowed),
  vector("one trade too many today", { tradesToday: 12, legs: [sell("NVDA", 1, 100)] }, {
    decision: "Wait",
    wait: "tradesPerDay"
  }),
  vector("the last trade today", { tradesToday: 11, legs: [sell("NVDA", 1, 100)] }, allowed),

  // Prices.
  vector("a buy 1% under Chainlink's price", { legs: [buy("NVDA", 100, 0.99)] }, allowed),
  vector("a buy just past 1%", { legs: [buy("NVDA", 100, 0.98999999)] }, blocked("unfairPrice NVDA")),
  vector("a sell 1% under", { legs: [sell("NVDA", 1, 99)] }, allowed),
  vector("a sell just past 1%", { legs: [sell("NVDA", 1, 98.99)] }, blocked("unfairPrice NVDA")),
  vector(
    "strict protection, 0.5% under",
    { limits: { priceProtection: 50 }, legs: [buy("NVDA", 100, 0.995)] },
    allowed
  ),
  vector(
    "strict protection, 1% under",
    { limits: { priceProtection: 50 }, legs: [buy("NVDA", 100, 0.99)] },
    blocked("unfairPrice NVDA")
  ),
  vector("relaxed protection, 2% under", { limits: { priceProtection: 200 }, legs: [buy("NVDA", 100, 0.98)] }, allowed),
  vector(
    "relaxed protection, just past 2%",
    { limits: { priceProtection: 200 }, legs: [buy("NVDA", 100, 0.97999999)] },
    blocked("unfairPrice NVDA")
  ),
  vector(
    "a price exactly 26 hours old is live",
    { prices: { ...PRICES, NVDA: feed(100, 26 * HOUR) }, legs: [buy("NVDA", 100, 0.99)] },
    allowed
  ),
  vector(
    "a second older, it is paused and the collar halves",
    { prices: { ...PRICES, NVDA: feed(100, 26 * HOUR + 1) }, legs: [buy("NVDA", 100, 0.99)] },
    blocked("unfairPrice NVDA")
  ),
  vector(
    "paused, 0.5% under",
    { prices: { ...PRICES, NVDA: feed(100, 30 * HOUR) }, legs: [buy("NVDA", 100, 0.995)] },
    allowed
  ),
  vector(
    "paused, with weekend trading off",
    {
      limits: { tradeWhilePaused: false },
      prices: { ...PRICES, NVDA: feed(100, 30 * HOUR) },
      legs: [buy("NVDA", 100, 1)]
    },
    blocked("pausedTradingOff NVDA")
  ),
  vector(
    "a price exactly 80 hours old is still paused",
    { prices: { ...PRICES, NVDA: feed(100, 80 * HOUR) }, legs: [buy("NVDA", 100, 1)] },
    allowed
  ),
  vector(
    "a second older, it is stale",
    { prices: { ...PRICES, NVDA: feed(100, 80 * HOUR + 1) }, legs: [buy("NVDA", 100, 1)] },
    blocked("pricesStale NVDA")
  ),
  vector(
    "a stale price on another holding",
    { prices: { ...PRICES, NVDA: feed(100, 81 * HOUR) }, legs: [buy("AAPL", 100, 0.5)] },
    blocked("pricesStale NVDA")
  ),
  vector(
    "a holding with no price",
    { prices: { NVDA: feed(100) }, legs: [buy("NVDA", 50, 0.5)] },
    blocked("pricesStale AAPL")
  ),

  // Holdings and the portfolio.
  vector(
    "a buy with too little cash",
    { holdings: { usdc: usdc(50), shares: { NVDA: shares(5) } }, legs: [buy("NVDA", 60, 0.6)] },
    blocked("insufficientBalance")
  ),
  vector(
    "a sell of more than is held",
    {
      limits: { maxPerTrade: usdc(1000), askAbove: usdc(1000) },
      holdings: { usdc: usdc(50), shares: { NVDA: shares(5) } },
      legs: [sell("NVDA", 6, 600)]
    },
    blocked("insufficientBalance")
  ),
  vector(
    "a buy just over the stock cap",
    { limits: { maxPerTrade: usdc(200) }, legs: [buy("NVDA", 101, 1.01)] },
    blocked("overStockCap NVDA")
  ),
  vector(
    "a sell of a stock already over its cap",
    { limits: { maxInOneStock: 1000 }, legs: [sell("NVDA", 0.5, 50)] },
    allowed
  ),
  vector(
    "a buy that keeps cash over the reserve",
    { limits: { maxInOneStock: 5000 }, holdings: held(250, 5, 2.5), legs: [buy("NVDA", 60, 0.6)] },
    allowed
  ),
  vector(
    "a buy that takes cash under the reserve",
    {
      limits: { maxInOneStock: 5000, cashReserve: 2000 },
      holdings: held(250, 5, 2.5),
      legs: [buy("NVDA", 60, 0.6)]
    },
    blocked("underCashReserve")
  ),
  vector(
    "a sell while cash is under the reserve",
    { limits: { cashReserve: 5000 }, holdings: held(250, 5, 2.5), legs: [sell("NVDA", 0.5, 50)] },
    allowed
  ),

  // Slippage budget: 1% of $2,000 is $20.
  vector("a $1 loss with $19 used", { slippage: { used: 19 }, legs: [buy("NVDA", 100, 0.99)] }, allowed),
  vector(
    "a $1 loss with $19.50 used",
    { slippage: { used: 19.5 }, legs: [buy("NVDA", 100, 0.99)] },
    blocked("overSlippageBudget")
  ),
  vector("the budget fully used, losing nothing", { slippage: { used: 20 }, legs: [buy("NVDA", 100, 1)] }, allowed),
  vector(
    "$38 used three and a half days ago has decayed to $19",
    { slippage: { used: 38, daysAgo: 3.5 }, legs: [buy("NVDA", 100, 0.99)] },
    allowed
  ),
  vector(
    "a half-size budget",
    { limits: { weeklySlippage: 50 }, slippage: { used: 9.5 }, legs: [buy("NVDA", 100, 0.99)] },
    blocked("overSlippageBudget")
  ),

  vector(
    "every broken rule at once",
    { limits: { maxInOneStock: 1000 }, legs: [buy("TSLA", 300, 0.5)] },
    blocked(
      "notAllowedStock TSLA",
      "overDailyBudget",
      "overTradeSize TSLA",
      "unfairPrice TSLA",
      "overStockCap TSLA",
      "overSlippageBudget"
    )
  )
]

const rebalancerVectors: ReadonlyArray<Vector> = [
  vector(
    "buying what is underweight, up to its target",
    { base: REBALANCER, legs: [buy("NVDA", 100, 1)] },
    allowed
  ),
  vector(
    "buying both underweight stocks to the exact mix",
    { base: REBALANCER, legs: [buy("NVDA", 100, 1), buy("AAPL", 100, 0.5)] },
    allowed
  ),
  vector(
    "selling the overweight to buy the underweight, cash unchanged",
    { base: REBALANCER, holdings: held(800, 8, 2), legs: [sell("NVDA", 1, 100), buy("AAPL", 100, 0.5)] },
    allowed
  ),
  vector(
    "selling what is underweight",
    { base: REBALANCER, legs: [sell("NVDA", 0.5, 50)] },
    blocked("wrongWay NVDA", "wrongWay", "noProgress")
  ),
  vector(
    "buying what is overweight",
    { base: REBALANCER, holdings: held(800, 8, 2), legs: [buy("NVDA", 50, 0.5)] },
    blocked("overStockCap NVDA", "wrongWay NVDA", "wrongWay", "noProgress")
  ),
  vector(
    "buying past a target",
    {
      base: REBALANCER,
      limits: { maxPerTrade: usdc(200), maxInOneStock: 4000 },
      legs: [buy("NVDA", 110, 1.1)]
    },
    blocked("overshoots NVDA")
  ),
  vector(
    "selling past a target",
    {
      base: REBALANCER,
      limits: { maxPerTrade: usdc(300), askAbove: usdc(300) },
      holdings: held(800, 8, 2),
      legs: [sell("NVDA", 2.1, 210)]
    },
    blocked("overshoots NVDA", "wrongWay", "noProgress")
  ),
  vector(
    "drift exactly at the 1% band",
    { base: REBALANCER, holdings: held(820, 6, 2.9), legs: [buy("AAPL", 10, 0.05)] },
    allowed
  ),
  vector(
    "drift just inside the band",
    { base: REBALANCER, holdings: held(819, 6, 2.905), legs: [buy("AAPL", 10, 0.05)] },
    blocked("notNeeded")
  ),
  vector(
    "a portfolio on target",
    { base: REBALANCER, holdings: held(800, 6, 3), legs: [sell("AAPL", 0.05, 10)] },
    blocked("notNeeded")
  ),
  vector(
    "rebalancing while prices are paused",
    { base: REBALANCER, prices: { ...PRICES, NVDA: feed(100, 30 * HOUR) }, legs: [buy("NVDA", 100, 1)] },
    blocked("pausedTradingOff NVDA")
  ),
  vector(
    "rebalancing while paused, even with weekend trading on",
    {
      base: REBALANCER,
      limits: { tradeWhilePaused: true },
      prices: { ...PRICES, NVDA: feed(100, 30 * HOUR) },
      legs: [buy("NVDA", 100, 1)]
    },
    blocked("pausedTradingOff NVDA")
  )
]

const otherVectors: ReadonlyArray<Vector> = [
  vector(
    "a Weekly buyer's buy",
    {
      base: draftLimits({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] }),
      legs: [buy("NVDA", 100, 1)]
    },
    allowed
  ),
  vector(
    "a Stop-loss guard's sell",
    {
      base: draftLimits({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA"], targets: [] }),
      legs: [sell("NVDA", 1, 100)]
    },
    allowed
  ),
  vector(
    "a Stop-loss guard buying",
    {
      base: draftLimits({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA"], targets: [] }),
      legs: [buy("NVDA", 50, 0.5)]
    },
    blocked("wrongDirection NVDA", "overDailyBudget")
  )
]

export const VECTORS: ReadonlyArray<Vector> = [...pickerVectors, ...rebalancerVectors, ...otherVectors]
