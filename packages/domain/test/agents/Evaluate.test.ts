import {
  Allowed,
  Blocked,
  collarFor,
  type Decision,
  evaluate,
  type FeedPrice,
  holdingsAfter,
  type Leg,
  legLoss,
  legValue,
  NeedsApproval,
  priceMode,
  type Proposal,
  Violation,
  Wait
} from "@bluechip/domain/agents/Evaluate"
import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import type { Holdings } from "@bluechip/domain/agents/TradeMath"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))
const shares = (count: number) => Shares.make(BigInt(Math.round(count * 100_000_000)))
const feed = (dollars: number, ageSeconds = 60): FeedPrice => ({
  price: Price.make(BigInt(dollars) * BigInt(100_000_000)),
  ageSeconds
})

const buy = (symbol: Leg["symbol"], dollars: number, sharesOut: number): Leg => ({
  symbol,
  side: "buy",
  amountIn: usdc(dollars),
  amountOut: shares(sharesOut)
})

const sell = (symbol: Leg["symbol"], count: number, dollarsOut: number): Leg => ({
  symbol,
  side: "sell",
  amountIn: shares(count),
  amountOut: usdc(dollarsOut)
})

const HOUR = 3600
const NVDA_PRICE = Price.make(10_000_000_000n)

describe("priceMode", () => {
  it.each([
    { name: "a fresh price is live", age: 0, expected: "live" },
    { name: "26 hours old is live", age: 26 * HOUR, expected: "live" },
    { name: "a second past 26 hours is paused", age: 26 * HOUR + 1, expected: "paused" },
    { name: "80 hours old is paused", age: 80 * HOUR, expected: "paused" },
    { name: "a second past 80 hours is stale", age: 80 * HOUR + 1, expected: "stale" }
  ])("$name", ({ age, expected }) => {
    assert.strictEqual(priceMode(age), expected)
  })
})

describe("collarFor", () => {
  const limits = new Limits({
    ...draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA"], targets: [] }),
    priceProtection: 200
  })

  it.each(
    [
      { name: "live: the price protection", mode: "live", expected: 200 },
      { name: "paused: half of it", mode: "paused", expected: 100 },
      { name: "stale: the price protection", mode: "stale", expected: 200 }
    ] as const
  )("$name", ({ expected, mode }) => {
    assert.strictEqual(collarFor(limits, mode), expected)
  })
})

describe("legValue", () => {
  it.each([
    { name: "a buy is worth the USDC it spends", leg: buy("NVDA", 100, 0.5), expected: 100_000_000n },
    { name: "a sell is worth its shares at Chainlink's price", leg: sell("NVDA", 1.01, 50), expected: 101_000_000n }
  ])("$name", ({ expected, leg }) => {
    assert.strictEqual(legValue(leg, NVDA_PRICE), expected)
  })
})

describe("legLoss", () => {
  it.each([
    { name: "a buy 1% under Chainlink's price loses 1%", leg: buy("NVDA", 100, 0.99), expected: 1_000_000n },
    { name: "a buy at Chainlink's price loses nothing", leg: buy("NVDA", 100, 1), expected: 0n },
    { name: "a buy over Chainlink's price loses nothing", leg: buy("NVDA", 100, 1.01), expected: 0n },
    { name: "a sell 1% under Chainlink's price loses 1%", leg: sell("NVDA", 1, 99), expected: 1_000_000n },
    { name: "a sell over Chainlink's price loses nothing", leg: sell("NVDA", 1, 101), expected: 0n }
  ])("$name", ({ expected, leg }) => {
    assert.strictEqual(legLoss(leg, NVDA_PRICE), expected)
  })
})

describe("holdingsAfter", () => {
  const HELD: Holdings = { usdc: usdc(100), shares: { NVDA: shares(2) } }

  it.each<{ name: string; legs: ReadonlyArray<Leg>; expected: Holdings | undefined }>([
    {
      name: "a buy spends cash for shares",
      legs: [buy("NVDA", 100, 1)],
      expected: { usdc: 0n as Usdc, shares: { NVDA: 300_000_000n as Shares } }
    },
    {
      name: "a sell spends shares for cash",
      legs: [sell("NVDA", 2, 200)],
      expected: { usdc: 300_000_000n as Usdc, shares: { NVDA: 0n as Shares } }
    },
    {
      name: "a buy of a stock not held adds it",
      legs: [buy("AAPL", 50, 0.25)],
      expected: { usdc: 50_000_000n as Usdc, shares: { NVDA: 200_000_000n as Shares, AAPL: 25_000_000n as Shares } }
    },
    {
      name: "a sell's cash pays for a later buy",
      legs: [sell("NVDA", 1, 100), buy("AAPL", 200, 1)],
      expected: { usdc: 0n as Usdc, shares: { NVDA: 100_000_000n as Shares, AAPL: 100_000_000n as Shares } }
    },
    { name: "a buy a unit over the cash", legs: [buy("NVDA", 100.000001, 1)], expected: undefined },
    { name: "a sell a unit over the shares", legs: [sell("NVDA", 2.00000001, 200)], expected: undefined },
    {
      name: "a buy before the sell that would pay for it",
      legs: [buy("AAPL", 200, 1), sell("NVDA", 1, 100)],
      expected: undefined
    },
    { name: "no legs", legs: [], expected: { usdc: 100_000_000n as Usdc, shares: { NVDA: 200_000_000n as Shares } } }
  ])("$name", ({ expected, legs }) => {
    assert.deepStrictEqual(holdingsAfter(HELD, legs), expected)
  })
})

describe("evaluate", () => {
  const NOW = DateTime.makeUnsafe("2026-11-25T15:00:00Z")
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

  // $1,000 cash, 5 NVDA at $100 and 2.5 AAPL at $200: $2,000 in all, for a balanced Stock picker ($250 a day, $100 a
  // trade, ask above $150, 30% in one stock, 10% cash, 1% price protection and weekly slippage, 12 trades a day).
  const proposal = (options: {
    readonly legs: ReadonlyArray<Leg>
    readonly limits?: Partial<Limits>
    readonly base?: Limits
    readonly holdings?: Holdings
    readonly prices?: Proposal["prices"]
    readonly spentToday?: number
    readonly tradesToday?: number
  }): Proposal => ({
    limits: new Limits({ ...(options.base ?? PICKER), ...options.limits }),
    holdings: options.holdings ?? { usdc: usdc(1000), shares: { NVDA: shares(5), AAPL: shares(2.5) } },
    prices: options.prices ?? { NVDA: feed(100), AAPL: feed(200), TSLA: feed(400) },
    usage: {
      spentToday: usdc(options.spentToday ?? 0),
      tradesToday: options.tradesToday ?? 0,
      slippage: { used: usdc(0), updatedAt: 0 }
    },
    legs: options.legs,
    now: NOW
  })

  const blocked = (...violations: Array<[Violation["rule"], Violation["symbol"], string]>) =>
    new Blocked({ violations: violations.map(([rule, symbol, message]) => new Violation({ rule, symbol, message })) })

  const TOMORROW = DateTime.makeUnsafe("2026-11-26T00:00:00Z")

  it.each<{ name: string; proposal: Proposal; expected: Decision }>([
    {
      name: "a buy at Chainlink's price: allowed, losing nothing",
      proposal: proposal({ legs: [buy("NVDA", 100, 1)] }),
      expected: new Allowed({ loss: usdc(0) })
    },
    {
      name: "a buy 1% under Chainlink's price: allowed, losing $1",
      proposal: proposal({ legs: [buy("NVDA", 100, 0.99)] }),
      expected: new Allowed({ loss: usdc(1) })
    },
    {
      name: "two legs: allowed, losing both legs' losses",
      proposal: proposal({ legs: [sell("NVDA", 1, 99), buy("AAPL", 50, 0.2475)], limits: { maxInOneStock: 5000 } }),
      expected: new Allowed({ loss: usdc(1.5) })
    },
    {
      name: "a buy over ask-me: needs approval, with its loss",
      proposal: proposal({ legs: [buy("NVDA", 60, 0.594)], limits: { askAbove: usdc(50) } }),
      expected: new NeedsApproval({ loss: usdc(0.6) })
    },
    {
      name: "a buy past today's budget: waits for the next UTC day",
      proposal: proposal({ legs: [buy("NVDA", 100, 1)], spentToday: 200 }),
      expected: new Wait({ reason: "dailyBudget", until: TOMORROW })
    },
    {
      name: "one trade too many today: waits for the next UTC day",
      proposal: proposal({ legs: [sell("NVDA", 1, 100)], tradesToday: 12 }),
      expected: new Wait({ reason: "tradesPerDay", until: TOMORROW })
    },
    {
      name: "budget and trades both used up: waits on the budget",
      proposal: proposal({ legs: [buy("NVDA", 100, 1)], spentToday: 200, tradesToday: 12 }),
      expected: new Wait({ reason: "dailyBudget", until: TOMORROW })
    },
    {
      name: "a buy over ask-me past today's budget: waits rather than asks",
      proposal: proposal({ legs: [buy("NVDA", 100, 1)], limits: { askAbove: usdc(50) }, spentToday: 200 }),
      expected: new Wait({ reason: "dailyBudget", until: TOMORROW })
    },
    {
      name: "a blocked buy past today's budget: blocked rather than waiting",
      proposal: proposal({ legs: [buy("NVDA", 4, 0.04)], spentToday: 250 }),
      expected: blocked(["tooSmall", "NVDA", "Trades start at $5.00."])
    },
    {
      name: "nothing to trade: says so",
      proposal: proposal({ legs: [] }),
      expected: blocked(["nothingToTrade", null, "There's nothing to trade."])
    },
    {
      name: "a sell-only agent buying: says which way it trades",
      proposal: proposal({ legs: [buy("NVDA", 50, 0.5)], limits: { mode: "sell" } }),
      expected: blocked(["wrongDirection", "NVDA", "This agent can only sell."])
    },
    {
      name: "a stale price on the traded stock: says it is too old to trade on",
      proposal: proposal({ legs: [buy("NVDA", 100, 1)], prices: { NVDA: feed(100, 81 * HOUR), AAPL: feed(200) } }),
      expected: blocked(["pricesStale", "NVDA", "NVDA's price is too old to trade on."])
    },
    {
      name: "no price for another holding: says it is too old to value the portfolio",
      proposal: proposal({ legs: [buy("NVDA", 50, 0.5)], prices: { NVDA: feed(100) } }),
      expected: blocked(["pricesStale", "AAPL", "AAPL's price is too old to value your portfolio."])
    },
    {
      name: "paused prices with weekend trading off: says it doesn't trade while paused",
      proposal: proposal({
        legs: [buy("NVDA", 100, 1)],
        limits: { tradeWhilePaused: false },
        prices: { NVDA: feed(100, 30 * HOUR), AAPL: feed(200) }
      }),
      expected: blocked(["pausedTradingOff", "NVDA", "This agent doesn't trade while prices are paused."])
    },
    {
      name: "a buy with too little cash: says the account doesn't hold enough",
      proposal: proposal({ legs: [buy("NVDA", 60, 0.6)], holdings: { usdc: usdc(50), shares: { NVDA: shares(5) } } }),
      expected: blocked(["insufficientBalance", null, "The account doesn't hold enough for this trade."])
    },
    {
      name: "a buy taking cash under the reserve: names the reserve",
      proposal: proposal({
        legs: [buy("NVDA", 60, 0.6)],
        limits: { maxInOneStock: 5000, cashReserve: 2000 },
        holdings: { usdc: usdc(250), shares: { NVDA: shares(5), AAPL: shares(2.5) } }
      }),
      expected: blocked(["underCashReserve", null, "Cash would fall under 20% of your money."])
    },
    {
      name: "every broken rule at once: names each",
      proposal: proposal({ legs: [buy("TSLA", 300, 0.5)], limits: { maxInOneStock: 1000 } }),
      expected: blocked(
        ["notAllowedStock", "TSLA", "This agent can't trade TSLA."],
        ["overDailyBudget", null, "That's more than the daily budget of $250.00."],
        ["overTradeSize", "TSLA", "That's more than $100.00 in one trade."],
        ["unfairPrice", "TSLA", "TSLA's price is too far from Chainlink's."],
        ["overStockCap", "TSLA", "TSLA would be over 10% of your money."],
        ["overSlippageBudget", null, "This agent has lost its weekly allowance to prices."]
      )
    },
    {
      name: "a Rebalancer on target: says the portfolio is already close",
      proposal: proposal({
        base: REBALANCER,
        legs: [sell("AAPL", 0.05, 10)],
        holdings: { usdc: usdc(800), shares: { NVDA: shares(6), AAPL: shares(3) } }
      }),
      expected: blocked(["notNeeded", null, "Your portfolio is already close to its target mix."])
    },
    {
      name: "a Rebalancer buying what is overweight: names each asset moving the wrong way",
      proposal: proposal({
        base: REBALANCER,
        legs: [buy("NVDA", 50, 0.5)],
        holdings: { usdc: usdc(800), shares: { NVDA: shares(8), AAPL: shares(2) } }
      }),
      expected: blocked(
        ["overStockCap", "NVDA", "NVDA would be over 30% of your money."],
        ["wrongWay", "NVDA", "NVDA would move away from its target."],
        ["wrongWay", null, "USDC would move away from its target."],
        ["noProgress", null, "This wouldn't bring your portfolio closer to its target mix."]
      )
    },
    {
      name: "a Rebalancer buying past a target: says it would go past",
      proposal: proposal({
        base: REBALANCER,
        legs: [buy("NVDA", 110, 1.1)],
        limits: { maxPerTrade: usdc(200), maxInOneStock: 4000 }
      }),
      expected: blocked(["overshoots", "NVDA", "NVDA would go past its target."])
    }
  ])("$name", ({ expected, proposal }) => {
    assert.deepStrictEqual(evaluate(proposal), expected)
  })
})
