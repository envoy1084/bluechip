import { type Decision, evaluate, type FeedPrice, type Leg, type Proposal } from "@bluechip/domain/agents/Evaluate"
import { Target } from "@bluechip/domain/agents/Limits"
import { rebalanceBreaches } from "@bluechip/domain/agents/Rebalance"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { drift, type Holdings, valueHoldings } from "@bluechip/domain/agents/TradeMath"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const usdc = (dollars: number) => Usdc.make(BigInt(Math.round(dollars * 1_000_000)))
const shares = (count: number) => Shares.make(BigInt(Math.round(count * 100_000_000)))
const feed = (dollars: number, ageSeconds = 60): FeedPrice => ({
  price: Price.make(BigInt(dollars) * BigInt(100_000_000)),
  ageSeconds
})

// The target mix: 30% NVDA, 30% AAPL, 40% cash.
const limits = draftLimits({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

const prices = { NVDA: feed(100), AAPL: feed(200) }

const holdings = (cash: number, nvda: number, aapl: number): Holdings => ({
  usdc: usdc(cash),
  shares: { NVDA: shares(nvda), AAPL: shares(aapl) }
})

const proposal = (held: Holdings, legs: ReadonlyArray<Leg>): Proposal => ({
  limits,
  holdings: held,
  prices,
  usage: { spentToday: usdc(0), tradesToday: 0, slippage: { used: usdc(0), updatedAt: 0 } },
  legs,
  now: DateTime.makeUnsafe("2026-11-25T15:00:00Z")
})

const rules = (decision: Decision) =>
  decision._tag === "Blocked"
    ? decision.violations.map(({ rule, symbol }) => `${rule}${symbol ? ` ${symbol}` : ""}`)
    : []

// $1,000 cash (50%), $500 NVDA (25%), $500 AAPL (25%): 10% off the mix.
const offMix = holdings(1000, 5, 2.5)

describe("drift", () => {
  it("is half the summed distance from target, in basis points", () => {
    const priced = { NVDA: prices.NVDA.price, AAPL: prices.AAPL.price }
    assert.strictEqual(drift(valueHoldings(offMix, priced), limits.targets), 1000)
    assert.strictEqual(drift(valueHoldings(holdings(800, 6, 3), priced), limits.targets), 0)
  })
})

describe("rebalancing", () => {
  it("buys what is underweight, up to its target", () => {
    // NVDA reaches exactly 30%, cash falls from 50% to 45%: drift 10% → 5%.
    assert.strictEqual(evaluate(proposal(offMix, [buy("NVDA", 100, 1)]))._tag, "Allowed")
  })

  it("sells what is overweight to buy what is underweight, judged on the net change", () => {
    // $800 cash (40%), $800 NVDA (40%), $400 AAPL (20%): sell $100 of NVDA, buy $100 of AAPL, cash stays put.
    const tilted = holdings(800, 8, 2)
    assert.strictEqual(evaluate(proposal(tilted, [sell("NVDA", 1, 100), buy("AAPL", 100, 0.5)]))._tag, "Allowed")
  })

  it("never sells what is underweight, or buys what is over", () => {
    assert.deepStrictEqual(rules(evaluate(proposal(offMix, [sell("NVDA", 0.5, 50)]))), [
      "wrongWay NVDA",
      "wrongWay",
      "noProgress"
    ])
    const tilted = holdings(800, 8, 2)
    assert.deepStrictEqual(rules(evaluate(proposal(tilted, [buy("NVDA", 50, 0.5)]))), [
      "overStockCap NVDA",
      "wrongWay NVDA",
      "wrongWay",
      "noProgress"
    ])
  })

  it("never passes a target by more than 5 basis points", () => {
    const roomy = { ...limits, maxPerTrade: usdc(200), maxInOneStock: 4000 }
    const decision = evaluate({ ...proposal(offMix, [buy("NVDA", 110, 1.1)]), limits: { ...limits, ...roomy } })
    assert.deepStrictEqual(rules(decision), ["overshoots NVDA"])
  })

  it("does nothing once the portfolio is within the band", () => {
    assert.deepStrictEqual(rules(evaluate(proposal(holdings(800, 6, 3), [sell("AAPL", 0.05, 10)]))), ["notNeeded"])
  })

  it("only trades on live prices", () => {
    const paused = { ...proposal(offMix, [buy("NVDA", 100, 1)]), prices: { ...prices, NVDA: feed(100, 30 * 3600) } }
    assert.deepStrictEqual(rules(evaluate(paused)), ["pausedTradingOff NVDA"])
  })

  it("needs real progress and the portfolio's value", () => {
    const priced = { NVDA: prices.NVDA.price, AAPL: prices.AAPL.price }
    const before = valueHoldings(offMix, priced)

    // Losing $30 of $2,000 (1.5%) is more than a 1% price protection allows.
    const poorer = valueHoldings(holdings(970, 5, 2.5), priced)
    assert.deepStrictEqual(
      rebalanceBreaches({ limits, before, after: poorer, moved: ["NVDA"] }).map((breach) => breach.rule),
      ["losesValue"]
    )

    const same = valueHoldings(offMix, priced)
    assert.deepStrictEqual(
      rebalanceBreaches({ limits, before, after: same, moved: [] }).map((breach) => breach.rule),
      ["noProgress"]
    )
  })
})

function buy(symbol: Leg["symbol"], dollars: number, sharesOut: number): Leg {
  return { symbol, side: "buy", amountIn: usdc(dollars), amountOut: shares(sharesOut) }
}

function sell(symbol: Leg["symbol"], count: number, dollarsOut: number): Leg {
  return { symbol, side: "sell", amountIn: shares(count), amountOut: usdc(dollarsOut) }
}
