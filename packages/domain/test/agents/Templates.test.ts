import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { validate } from "@bluechip/domain/agents/Rules"
import { draftLimits, type Preset, type Template } from "@bluechip/domain/agents/Templates"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const TARGETS = [new Target({ asset: "NVDA", weight: 2000 }), new Target({ asset: "USDC", weight: 8000 })]

describe("draftLimits", () => {
  it("a balanced Stock picker", () => {
    const limits = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

    assert.deepStrictEqual(
      limits,
      new Limits({
        stocks: ["NVDA", "AAPL"],
        mode: "both",
        dailyBudget: Usdc.make(250_000_000n),
        maxPerTrade: Usdc.make(100_000_000n),
        askAbove: Usdc.make(150_000_000n),
        maxInOneStock: 3000,
        cashReserve: 1000,
        targets: [],
        tradesPerDay: 12,
        priceProtection: 100,
        weeklySlippage: 100,
        rebalanceTrigger: 500,
        tradeWhilePaused: true
      })
    )
  })

  it("a conservative Rebalancer keeps its target mix and never trades while paused", () => {
    const limits = draftLimits({ template: "rebalancer", preset: "conservative", stocks: ["NVDA"], targets: TARGETS })

    assert.deepStrictEqual(
      limits,
      new Limits({
        stocks: ["NVDA"],
        mode: "rebalance",
        dailyBudget: Usdc.make(100_000_000n),
        maxPerTrade: Usdc.make(50_000_000n),
        askAbove: Usdc.make(50_000_000n),
        maxInOneStock: 2000,
        cashReserve: 2000,
        targets: TARGETS,
        tradesPerDay: 6,
        priceProtection: 100,
        weeklySlippage: 100,
        rebalanceTrigger: 500,
        tradeWhilePaused: false
      })
    )
  })

  it("an active Weekly buyer: the $1,000 preset budget is capped at the template's $500, targets dropped", () => {
    const limits = draftLimits({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: TARGETS })

    assert.deepStrictEqual(
      limits,
      new Limits({
        stocks: ["NVDA"],
        mode: "buy",
        dailyBudget: Usdc.make(500_000_000n),
        maxPerTrade: Usdc.make(400_000_000n),
        askAbove: Usdc.make(500_000_000n),
        maxInOneStock: 4000,
        cashReserve: 500,
        targets: [],
        tradesPerDay: 1,
        priceProtection: 100,
        weeklySlippage: 100,
        rebalanceTrigger: 500,
        tradeWhilePaused: true
      })
    )
  })

  it("an active Stop-loss guard never buys", () => {
    const limits = draftLimits({ template: "stopLossGuard", preset: "active", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(
      limits,
      new Limits({
        stocks: ["NVDA"],
        mode: "sell",
        dailyBudget: Usdc.make(0n),
        maxPerTrade: Usdc.make(400_000_000n),
        askAbove: Usdc.make(500_000_000n),
        maxInOneStock: 4000,
        cashReserve: 500,
        targets: [],
        tradesPerDay: 4,
        priceProtection: 100,
        weeklySlippage: 100,
        rebalanceTrigger: 500,
        tradeWhilePaused: true
      })
    )
  })

  it.each(
    (["rebalancer", "stockPicker", "weeklyBuyer", "stopLossGuard"] as const).flatMap((template) =>
      (["conservative", "balanced", "active"] as const).map((preset) => ({ template, preset }))
    )
  )("drafts limits that lock: $template, $preset", ({ preset, template }: { template: Template; preset: Preset }) => {
    const limits = draftLimits({ template, preset, stocks: ["NVDA"], targets: TARGETS })

    assert.deepStrictEqual(validate(limits, template), [])
  })
})
