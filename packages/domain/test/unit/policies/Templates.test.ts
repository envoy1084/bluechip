import { Usdc } from "@bluechip/domain/market/Units"
import { checkSpec } from "@bluechip/domain/policies/Catalog"
import { draftSpec, Preset, TemplateId, templateInfos } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"

const TARGETS = [{ asset: "NVDA", weight: 2000 }, { asset: "USDC", weight: 8000 }] as const

describe("draftSpec", () => {
  it("a balanced Stock picker", () => {
    const spec = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

    assert.deepStrictEqual(spec.policies, [
      { id: "trade", config: { stocks: ["NVDA", "AAPL"], direction: "both", dailyBudget: Usdc.make(250_000_000n) } },
      { id: "tradeSize", config: { maxPerTrade: Usdc.make(100_000_000n), minPerTrade: Usdc.make(5_000_000n) } },
      { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: true } },
      { id: "stockCap", config: { maxBps: 3000 } },
      { id: "cashReserve", config: { minBps: 1000 } },
      { id: "slippageBudget", config: { weeklyBps: 100 } },
      { id: "tradesPerDay", config: { count: 500 } },
      { id: "gasBudget", config: { weiPerDay: 38_000_000_000_000_000n } },
      { id: "anyCall", config: {} }
    ])
  })

  it.each<{ preset: Preset; weiPerDay: bigint }>([
    { preset: "conservative", weiPerDay: 15_000_000_000_000_000n },
    { preset: "balanced", weiPerDay: 38_000_000_000_000_000n },
    { preset: "active", weiPerDay: 90_000_000_000_000_000n }
  ])("a $preset Weekly buyer's gas budget covers the preset's trades", ({ preset, weiPerDay }) => {
    const spec = draftSpec({ template: "weeklyBuyer", preset, stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(spec.policies.find((entry) => entry.id === "gasBudget"), {
      id: "gasBudget",
      config: { weiPerDay }
    })
  })

  it("a conservative Rebalancer: its own $500 budget and $200 trades, trading while paused", () => {
    const spec = draftSpec({ template: "rebalancer", preset: "conservative", stocks: ["NVDA"], targets: TARGETS })

    assert.deepStrictEqual(spec.policies.slice(0, 7), [
      { id: "trade", config: { stocks: ["NVDA"], direction: "rebalance", dailyBudget: Usdc.make(500_000_000n) } },
      { id: "tradeSize", config: { maxPerTrade: Usdc.make(200_000_000n), minPerTrade: Usdc.make(5_000_000n) } },
      { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: true } },
      { id: "stockCap", config: { maxBps: 2000 } },
      { id: "cashReserve", config: { minBps: 2000 } },
      { id: "rebalance", config: { targets: TARGETS, triggerBps: 500 } },
      { id: "slippageBudget", config: { weeklyBps: 100 } }
    ])
  })

  it("an active Weekly buyer: the $1,000 preset budget is capped at the template's $500", () => {
    const spec = draftSpec({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(spec.policies.slice(0, 2), [
      { id: "trade", config: { stocks: ["NVDA"], direction: "buy", dailyBudget: Usdc.make(500_000_000n) } },
      { id: "tradeSize", config: { maxPerTrade: Usdc.make(400_000_000n), minPerTrade: Usdc.make(5_000_000n) } }
    ])
  })

  it("a Stop-loss guard only sells, spends nothing and carries no stock cap or cash reserve", () => {
    const spec = draftSpec({ template: "stopLossGuard", preset: "active", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(spec.policies.map((entry) => entry.id), [
      "trade",
      "tradeSize",
      "fairPrice",
      "slippageBudget",
      "tradesPerDay",
      "gasBudget",
      "anyCall"
    ])
    assert.deepStrictEqual(spec.policies[0], {
      id: "trade",
      config: { stocks: ["NVDA"], direction: "sell", dailyBudget: Usdc.make(0n) }
    })
  })

  it.each(TemplateId.literals.flatMap((template) => Preset.literals.map((preset) => ({ template, preset }))))(
    "a $preset $template can be locked",
    ({ preset, template }) => {
      const spec = draftSpec({ template, preset, stocks: ["NVDA"], targets: TARGETS })

      assert.deepStrictEqual(checkSpec(spec), [])
    }
  )
})

describe("templateInfos", () => {
  it("describes each built-in template, in the order they are offered, with its direction and rules", () => {
    assert.deepStrictEqual(
      templateInfos().map(({ direction, id, options, rules }) => ({ id, direction, rules, options })),
      [
        { id: "stockPicker", direction: "both", rules: ["stockCap", "cashReserve", "slippageBudget"], options: [] },
        { id: "weeklyBuyer", direction: "buy", rules: ["stockCap", "cashReserve", "slippageBudget"], options: [] },
        { id: "stopLossGuard", direction: "sell", rules: ["slippageBudget"], options: ["stopLossFloor"] },
        {
          id: "rebalancer",
          direction: "rebalance",
          rules: ["stockCap", "cashReserve", "rebalance", "slippageBudget"],
          options: []
        }
      ]
    )
  })
})
