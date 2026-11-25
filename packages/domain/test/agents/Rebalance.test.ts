import { Target } from "@bluechip/domain/agents/Limits"
import { type RebalanceBreach, rebalanceBreaches } from "@bluechip/domain/agents/Rebalance"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import type { Valuation } from "@bluechip/domain/agents/TradeMath"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

// Targets 40% cash, 30% NVDA, 30% AAPL; a 1% band (5% trigger), 1% price protection.
const LIMITS = draftLimits({
  template: "rebalancer",
  preset: "balanced",
  stocks: ["NVDA", "AAPL"],
  targets: [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
})

// Values in USDC units, cash then NVDA then AAPL; a $10,000-unit portfolio makes each unit a basis point.
const valuation = (usdc: number, nvda: number, aapl: number): Valuation => ({
  total: Usdc.make(BigInt(usdc + nvda + aapl)),
  values: new Map([["USDC", Usdc.make(BigInt(usdc))], ["NVDA", Usdc.make(BigInt(nvda))], [
    "AAPL",
    Usdc.make(BigInt(aapl))
  ]])
})

describe("rebalanceBreaches", () => {
  it.each<{
    name: string
    before: Valuation
    after: Valuation
    moved: ReadonlyArray<StockSymbol>
    expected: ReadonlyArray<RebalanceBreach>
  }>([
    {
      name: "a portfolio on target: not needed",
      before: valuation(4000, 3000, 3000),
      after: valuation(3900, 3100, 3000),
      moved: ["NVDA"],
      expected: [{ rule: "notNeeded", asset: null }]
    },
    {
      name: "drift a basis point inside the band: not needed",
      before: valuation(4099, 3000, 2901),
      after: valuation(4000, 3000, 3000),
      moved: ["AAPL"],
      expected: [{ rule: "notNeeded", asset: null }]
    },
    {
      name: "drift on the band: rebalances",
      before: valuation(4100, 3000, 2900),
      after: valuation(4000, 3000, 3000),
      moved: ["AAPL"],
      expected: []
    },
    {
      name: "buying an underweight stock toward its target",
      before: valuation(5000, 2500, 2500),
      after: valuation(4500, 3000, 2500),
      moved: ["NVDA"],
      expected: []
    },
    {
      name: "buying an overweight stock, with cash at its target: wrong way",
      before: valuation(4000, 4000, 2000),
      after: valuation(3500, 4500, 2000),
      moved: ["NVDA"],
      expected: [{ rule: "wrongWay", asset: "NVDA" }, { rule: "wrongWay", asset: "USDC" }, {
        rule: "noProgress",
        asset: null
      }]
    },
    {
      name: "selling an underweight stock, into overweight cash: wrong way",
      before: valuation(5000, 2500, 2500),
      after: valuation(5500, 2000, 2500),
      moved: ["NVDA"],
      expected: [{ rule: "wrongWay", asset: "NVDA" }, { rule: "wrongWay", asset: "USDC" }, {
        rule: "noProgress",
        asset: null
      }]
    },
    {
      name: "buying to 5 basis points past a target",
      before: valuation(5000, 2500, 2500),
      after: valuation(4495, 3005, 2500),
      moved: ["NVDA"],
      expected: []
    },
    {
      name: "buying to 6 basis points past a target: overshoots",
      before: valuation(5000, 2500, 2500),
      after: valuation(4494, 3006, 2500),
      moved: ["NVDA"],
      expected: [{ rule: "overshoots", asset: "NVDA" }]
    },
    {
      name: "selling to 5 basis points under a target",
      before: valuation(3000, 4000, 3000),
      after: valuation(4005, 2995, 3000),
      moved: ["NVDA"],
      expected: []
    },
    {
      name: "selling to 6 basis points under a target, into cash 6 past its own: both overshoot",
      before: valuation(3000, 4000, 3000),
      after: valuation(4006, 2994, 3000),
      moved: ["NVDA"],
      expected: [{ rule: "overshoots", asset: "NVDA" }, { rule: "overshoots", asset: "USDC" }]
    },
    {
      name: "a stock swap leaving 5 basis points in cash: cash didn't trade",
      before: valuation(4000, 4000, 2000),
      after: valuation(4005, 3000, 2995),
      moved: ["NVDA", "AAPL"],
      expected: []
    },
    {
      name: "a stock swap leaving 6 basis points in cash: cash moved the wrong way",
      before: valuation(4000, 4000, 2000),
      after: valuation(4006, 3000, 2994),
      moved: ["NVDA", "AAPL"],
      expected: [{ rule: "wrongWay", asset: "USDC" }]
    },
    {
      name: "a traded stock whose value didn't change is skipped",
      before: valuation(5000, 2500, 2500),
      after: valuation(4500, 3000, 2500),
      moved: ["NVDA", "AAPL"],
      expected: []
    },
    {
      name: "drift down 9 basis points: no progress",
      before: valuation(5000, 2500, 2500),
      after: valuation(4991, 2509, 2500),
      moved: ["NVDA"],
      expected: [{ rule: "noProgress", asset: null }]
    },
    {
      name: "drift down 10 basis points: progress",
      before: valuation(5000, 2500, 2500),
      after: valuation(4990, 2510, 2500),
      moved: ["NVDA"],
      expected: []
    },
    {
      name: "losing exactly the price protection (1%)",
      before: valuation(5000, 2500, 2500),
      after: valuation(4500, 2900, 2500),
      moved: ["NVDA"],
      expected: []
    },
    {
      name: "losing 3%: loses value",
      before: valuation(5000, 2500, 2500),
      after: valuation(4300, 2900, 2500),
      moved: ["NVDA"],
      expected: [{ rule: "losesValue", asset: null }]
    }
  ])("$name", ({ after, before, expected, moved }) => {
    assert.deepStrictEqual(rebalanceBreaches({ limits: LIMITS, before, after, moved }), expected)
  })
})
