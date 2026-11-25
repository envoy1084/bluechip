import { Target } from "@bluechip/domain/agents/Limits"
import {
  chargeSlippage,
  drift,
  isAtMostBps,
  isWithinCollar,
  slippageUsed,
  type Valuation,
  valueHoldings
} from "@bluechip/domain/agents/TradeMath"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const DAY = 86_400

describe("valueHoldings", () => {
  it("values each stock at its price, with cash, and totals them", () => {
    const valuation = valueHoldings(
      { usdc: Usdc.make(1_000_000_000n), shares: { NVDA: Shares.make(500_000_000n), AAPL: Shares.make(250_000_000n) } },
      { NVDA: Price.make(10_000_000_000n), AAPL: Price.make(20_000_000_000n) }
    )

    assert.deepStrictEqual(valuation, {
      total: Usdc.make(2_000_000_000n),
      values: new Map<StockSymbol | "USDC", Usdc>([
        ["USDC", Usdc.make(1_000_000_000n)],
        ["NVDA", Usdc.make(500_000_000n)],
        ["AAPL", Usdc.make(500_000_000n)]
      ])
    })
  })

  it("counts a stock without a price as worth nothing", () => {
    const valuation = valueHoldings(
      { usdc: Usdc.make(1_000_000_000n), shares: { NVDA: Shares.make(500_000_000n) } },
      {}
    )

    assert.deepStrictEqual(valuation, {
      total: Usdc.make(1_000_000_000n),
      values: new Map<StockSymbol | "USDC", Usdc>([["USDC", Usdc.make(1_000_000_000n)], ["NVDA", Usdc.make(0n)]])
    })
  })

  it("values cash alone", () => {
    assert.deepStrictEqual(valueHoldings({ usdc: Usdc.make(0n), shares: {} }, {}), {
      total: Usdc.make(0n),
      values: new Map<StockSymbol | "USDC", Usdc>([["USDC", Usdc.make(0n)]])
    })
  })
})

describe("isAtMostBps", () => {
  it.each([
    { name: "under the share", value: 2_999n, expected: true },
    { name: "exactly the share", value: 3_000n, expected: true },
    { name: "one unit over the share", value: 3_001n, expected: false }
  ])("$name", ({ expected, value }) => {
    assert.strictEqual(isAtMostBps(value, 10_000n, 3_000), expected)
  })
})

describe("isWithinCollar", () => {
  it.each([
    { name: "more than fair", received: 10_001n, expected: true },
    { name: "exactly the collar under fair", received: 9_900n, expected: true },
    { name: "one unit past the collar", received: 9_899n, expected: false }
  ])("$name", ({ expected, received }) => {
    assert.strictEqual(isWithinCollar(received, 10_000n, 100), expected)
  })
})

describe("drift", () => {
  const TARGETS = [
    new Target({ asset: "NVDA", weight: 3000 }),
    new Target({ asset: "AAPL", weight: 3000 }),
    new Target({ asset: "USDC", weight: 4000 })
  ]
  const valuation = (values: Partial<Record<StockSymbol | "USDC", bigint>>): Valuation => {
    const entries = Object.entries(values) as Array<[StockSymbol | "USDC", bigint]>
    return {
      total: Usdc.make(entries.reduce((sum, [, value]) => sum + value, 0n)),
      values: new Map(entries.map(([asset, value]) => [asset, Usdc.make(value)]))
    }
  }

  it.each([
    { name: "a portfolio on target", values: { USDC: 4_000n, NVDA: 3_000n, AAPL: 3_000n }, expected: 0 },
    // 50% cash, 25% NVDA, 25% AAPL: (10% + 5% + 5%) ÷ 2.
    { name: "a portfolio 10% off target", values: { USDC: 5_000n, NVDA: 2_500n, AAPL: 2_500n }, expected: 1000 },
    // AAPL is missing (30% off); TSLA has no target (30% off).
    {
      name: "an asset held without a target counts against zero",
      values: { USDC: 4_000n, NVDA: 3_000n, TSLA: 3_000n },
      expected: 3000
    },
    // Thirds: (6.67% + 3.33% + 3.33%) ÷ 2 = 6.67%.
    { name: "a fraction of a basis point rounds down", values: { USDC: 1n, NVDA: 1n, AAPL: 1n }, expected: 666 },
    { name: "an empty portfolio", values: { USDC: 0n }, expected: 0 }
  ])("$name", ({ expected, values }) => {
    assert.strictEqual(drift(valuation(values), TARGETS), expected)
  })
})

describe("slippageUsed", () => {
  it.each([
    { name: "no time passed", used: 20_000_000n, elapsed: 0, expected: 20_000_000n },
    { name: "half the window passed", used: 20_000_000n, elapsed: 3.5 * DAY, expected: 10_000_000n },
    { name: "a part of a unit left rounds up", used: 1n, elapsed: 1, expected: 1n },
    { name: "a second short of the window", used: 7 * DAY, elapsed: 7 * DAY - 1, expected: 1n },
    { name: "the whole window passed", used: 20_000_000n, elapsed: 7 * DAY, expected: 0n },
    { name: "more than the window passed", used: 20_000_000n, elapsed: 8 * DAY, expected: 0n },
    { name: "a clock behind the ledger", used: 20_000_000n, elapsed: -60, expected: 20_000_000n }
  ])("$name", ({ elapsed, expected, used }) => {
    assert.strictEqual(
      slippageUsed({ used: Usdc.make(BigInt(used)), updatedAt: 1_000_000 }, 1_000_000 + elapsed),
      expected
    )
  })
})

describe("chargeSlippage", () => {
  it("adds a loss to the decayed ledger, as of now", () => {
    const ledger = chargeSlippage({ used: Usdc.make(20_000_000n), updatedAt: 0 }, Usdc.make(1_000_000n), 3.5 * DAY)

    assert.deepStrictEqual(ledger, { used: 11_000_000n, updatedAt: 302_400 })
  })

  it("adds no loss", () => {
    const ledger = chargeSlippage({ used: Usdc.make(20_000_000n), updatedAt: 0 }, Usdc.make(0n), 0)

    assert.deepStrictEqual(ledger, { used: 20_000_000n, updatedAt: 0 })
  })
})
