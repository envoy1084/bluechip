import {
  type Decision,
  evaluate,
  type FeedPrice,
  type Leg,
  type Proposal,
  type Rule
} from "@bluechip/domain/agents/Evaluate"
import { Limits } from "@bluechip/domain/agents/Limits"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { chargeSlippage, slippageUsed } from "@bluechip/domain/agents/TradeMath"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))
const shares = (count: number) => Shares.make(BigInt(Math.round(count * 100_000_000)))
const price = (dollars: number, ageSeconds = 60): FeedPrice => ({
  price: Price.make(BigInt(dollars) * BigInt(100_000_000)),
  ageSeconds
})

const NOW = DateTime.makeUnsafe("2026-11-25T15:00:00Z")
const NOW_SECONDS = Number(DateTime.toEpochMillis(NOW) / 1000)

// $1,000 cash, 5 NVDA at $100 and 2.5 AAPL at $200: $2,000 in all.
const base: Proposal = {
  limits: draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] }),
  holdings: { usdc: usdc(1000), shares: { NVDA: shares(5), AAPL: shares(2.5) } },
  prices: { NVDA: price(100), AAPL: price(200), TSLA: price(400) },
  usage: { spentToday: usdc(0), tradesToday: 0, slippage: { used: usdc(0), updatedAt: NOW_SECONDS } },
  legs: [],
  now: NOW
}

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

const decide = (overrides: Partial<Proposal>, limits: Partial<Limits> = {}): Decision =>
  evaluate({ ...base, ...overrides, limits: new Limits({ ...base.limits, ...limits }) })

const rules = (decision: Decision): ReadonlyArray<Rule> =>
  decision._tag === "Blocked" ? decision.violations.map((violation) => violation.rule) : []

describe("evaluate", () => {
  it("allows a fair buy that lands exactly on the stock cap", () => {
    // 6 NVDA = $600 of $2,000: exactly 30%.
    const decision = decide({ legs: [buy("NVDA", 100, 1)] })
    assert.strictEqual(decision._tag, "Allowed")
    assert.strictEqual(decision._tag === "Allowed" && decision.loss, usdc(0))
  })

  it("allows a fair sell", () => {
    assert.strictEqual(decide({ legs: [sell("NVDA", 1, 100)] })._tag, "Allowed")
  })

  it("blocks an empty operation", () => {
    assert.deepStrictEqual(rules(decide({ legs: [] })), ["nothingToTrade"])
  })

  it("keeps to the agent's stocks and direction", () => {
    assert.deepStrictEqual(rules(decide({ legs: [buy("TSLA", 50, 0.125)] })), ["notAllowedStock"])
    assert.deepStrictEqual(rules(decide({ legs: [sell("NVDA", 0.5, 50)] }, { mode: "buy" })), ["wrongDirection"])
    assert.deepStrictEqual(rules(decide({ legs: [buy("NVDA", 50, 0.5)] }, { mode: "sell" })), ["wrongDirection"])
  })

  it("sizes trades between $5 and the max per trade, sells at Chainlink's price", () => {
    assert.deepStrictEqual(rules(decide({ legs: [buy("NVDA", 4.99, 0.0499)] })), ["tooSmall"])
    assert.strictEqual(decide({ legs: [buy("NVDA", 5, 0.05)] })._tag, "Allowed")
    assert.deepStrictEqual(rules(decide({ legs: [buy("AAPL", 101, 0.505)] }, { maxInOneStock: 5000 })), [
      "overTradeSize"
    ])
    // 1.01 NVDA is worth $101 at Chainlink's price, whatever the pool paid.
    assert.deepStrictEqual(rules(decide({ legs: [sell("NVDA", 1.01, 101)] })), ["overTradeSize"])
  })

  it("asks for Face ID above the ask-me amount", () => {
    assert.strictEqual(decide({ legs: [buy("NVDA", 60, 0.6)] }, { askAbove: usdc(50) })._tag, "NeedsApproval")
    assert.strictEqual(decide({ legs: [buy("NVDA", 50, 0.5)] }, { askAbove: usdc(50) })._tag, "Allowed")
    assert.strictEqual(decide({ legs: [buy("NVDA", 5, 0.05)] }, { askAbove: usdc(0) })._tag, "NeedsApproval")
  })

  it("blocks an operation over the daily budget, and waits when today's is used up", () => {
    const legs = [buy("NVDA", 100, 1), buy("AAPL", 100, 0.5), buy("NVDA", 100, 1)]
    assert.deepStrictEqual(rules(decide({ legs }, { maxInOneStock: 5000 })), ["overDailyBudget"])

    const waiting = decide({ legs: [buy("NVDA", 100, 1)], usage: { ...base.usage, spentToday: usdc(200) } })
    assert.strictEqual(waiting._tag, "Wait")
    assert.strictEqual(waiting._tag === "Wait" && waiting.reason, "dailyBudget")
    assert.isTrue(waiting._tag === "Wait" && DateTime.Equivalence(waiting.until, DateTime.makeUnsafe("2026-11-26")))

    const tired = decide({ legs: [sell("NVDA", 1, 100)], usage: { ...base.usage, tradesToday: 12 } })
    assert.strictEqual(tired._tag === "Wait" && tired.reason, "tradesPerDay")
  })

  it("holds fills to the collar, and to half of it while prices are paused", () => {
    assert.strictEqual(decide({ legs: [buy("NVDA", 100, 0.99)] })._tag, "Allowed")
    assert.deepStrictEqual(rules(decide({ legs: [buy("NVDA", 100, 0.98999999)] })), ["unfairPrice"])
    assert.deepStrictEqual(rules(decide({ legs: [sell("NVDA", 1, 98.99)] })), ["unfairPrice"])

    const paused = { prices: { ...base.prices, NVDA: price(100, 30 * 3600) } }
    assert.strictEqual(decide({ ...paused, legs: [buy("NVDA", 100, 0.995)] })._tag, "Allowed")
    assert.deepStrictEqual(rules(decide({ ...paused, legs: [buy("NVDA", 100, 0.99)] })), ["unfairPrice"])
    assert.deepStrictEqual(rules(decide({ ...paused, legs: [buy("NVDA", 100, 1)] }, { tradeWhilePaused: false })), [
      "pausedTradingOff"
    ])
  })

  it("never trades on a stale price, or values a portfolio with one", () => {
    const stale = { prices: { ...base.prices, NVDA: price(100, 81 * 3600) } }
    assert.deepStrictEqual(rules(decide({ ...stale, legs: [buy("NVDA", 100, 1)] })), ["pricesStale"])
    assert.deepStrictEqual(rules(decide({ ...stale, legs: [buy("AAPL", 100, 0.5)] })), ["pricesStale"])
    assert.deepStrictEqual(rules(decide({ prices: { NVDA: price(100) }, legs: [buy("NVDA", 50, 0.5)] })), [
      "pricesStale"
    ])
  })

  it("needs the holdings a trade spends", () => {
    const poor = { holdings: { usdc: usdc(50), shares: { NVDA: shares(5) } } }
    assert.deepStrictEqual(rules(decide({ ...poor, legs: [buy("NVDA", 60, 0.6)] })), ["insufficientBalance"])
    assert.deepStrictEqual(rules(decide({ ...poor, legs: [sell("NVDA", 6, 600)] }, { maxPerTrade: usdc(1000) })), [
      "insufficientBalance"
    ])
  })

  it("keeps a stock under its cap and cash over its reserve", () => {
    // 6.01 NVDA = $601 of $2,000: just over 30%.
    assert.deepStrictEqual(rules(decide({ legs: [buy("NVDA", 101, 1.01)] }, { maxPerTrade: usdc(200) })), [
      "overStockCap"
    ])
    // A sell never breaks the cap, even when the stock is already over it.
    assert.strictEqual(decide({ legs: [sell("NVDA", 0.5, 50)] }, { maxInOneStock: 1000 })._tag, "Allowed")

    // $250 cash of $1,250 is 20%; buying $60 leaves 15.2% (and NVDA at 44.8%, under a 50% cap).
    const lean = { holdings: { usdc: usdc(250), shares: { NVDA: shares(5), AAPL: shares(2.5) } } }
    assert.strictEqual(decide({ ...lean, legs: [buy("NVDA", 60, 0.6)] }, { maxInOneStock: 5000 })._tag, "Allowed")
    assert.deepStrictEqual(
      rules(decide({ ...lean, legs: [buy("NVDA", 60, 0.6)] }, { maxInOneStock: 5000, cashReserve: 2000 })),
      [
        "underCashReserve"
      ]
    )
    assert.strictEqual(decide({ ...lean, legs: [sell("NVDA", 0.5, 50)] }, { cashReserve: 5000 })._tag, "Allowed")
  })

  it("stops at the weekly slippage budget, which decays over seven days", () => {
    // 1% of $2,000 is $20; this buy loses $1.
    const losing = [buy("NVDA", 100, 0.99)]
    const used = (dollars: number, daysAgo = 0) => ({
      ...base.usage,
      slippage: { used: usdc(dollars), updatedAt: NOW_SECONDS - daysAgo * 86_400 }
    })

    assert.strictEqual(decide({ legs: losing, usage: used(19) })._tag, "Allowed")
    assert.deepStrictEqual(rules(decide({ legs: losing, usage: used(19.5) })), ["overSlippageBudget"])
    assert.strictEqual(decide({ legs: losing, usage: used(38, 3.5) })._tag, "Allowed")

    assert.strictEqual(slippageUsed({ used: usdc(20), updatedAt: 0 }, 3.5 * 86_400), usdc(10))
    assert.strictEqual(slippageUsed({ used: usdc(20), updatedAt: 0 }, 7 * 86_400), usdc(0))
    assert.deepStrictEqual(chargeSlippage({ used: usdc(20), updatedAt: 0 }, usdc(1), 3.5 * 86_400), {
      used: usdc(11),
      updatedAt: 3.5 * 86_400
    })
  })

  it("reports every broken rule at once", () => {
    const decision = decide({ legs: [buy("TSLA", 300, 0.5)] }, { maxInOneStock: 1000 })
    assert.deepStrictEqual(rules(decision), [
      "notAllowedStock",
      "overDailyBudget",
      "overTradeSize",
      "unfairPrice",
      "overStockCap",
      "overSlippageBudget"
    ])
  })
})
