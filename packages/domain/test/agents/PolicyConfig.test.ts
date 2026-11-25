import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { DAY_SECONDS, policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const picker = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

describe("policyConfig", () => {
  it("caps every trade an agent's key signs at the lower of max per trade and ask-me", () => {
    const config = policyConfig(picker)
    assert.strictEqual(config.trade.maxUsdcIn, Usdc.make(100_000_000n))
    assert.strictEqual(config.guard.maxTradeUsd, Usdc.make(100_000_000n))

    const asking = policyConfig(new Limits({ ...picker, askAbove: Usdc.make(50_000_000n) }))
    assert.strictEqual(asking.trade.maxUsdcIn, Usdc.make(50_000_000n))
    assert.strictEqual(asking.guard.maxTradeUsd, Usdc.make(50_000_000n))
  })

  it("values the whole portfolio but trades only the agent's stocks", () => {
    const { guard, trade } = policyConfig(picker)
    assert.deepStrictEqual(guard.valued, StockSymbol.literals)
    assert.deepStrictEqual(guard.allowed, ["NVDA", "AAPL"])
    assert.deepStrictEqual(trade.stocks, ["NVDA", "AAPL"])
  })

  it("halves the collar while prices are paused, and budgets per UTC day for 90 days", () => {
    const config = policyConfig(new Limits({ ...picker, priceProtection: 200 }))
    assert.strictEqual(config.guard.collarBps, 200)
    assert.strictEqual(config.guard.pausedCollarBps, 100)
    assert.strictEqual(config.trade.budgetPeriodSeconds, DAY_SECONDS)
    assert.strictEqual(config.expiresAfterSeconds, 90 * DAY_SECONDS)
    assert.strictEqual(config.tradesPerDay, 12)
  })

  it("never lets a Rebalancer trade on paused prices, and derives its band", () => {
    const rebalancer = draftLimits({
      template: "rebalancer",
      preset: "balanced",
      stocks: ["NVDA"],
      targets: [new Target({ asset: "NVDA", weight: 3000 }), new Target({ asset: "USDC", weight: 7000 })]
    })
    const config = policyConfig(new Limits({ ...rebalancer, tradeWhilePaused: true, rebalanceTrigger: 1000 }))
    assert.isFalse(config.guard.tradeWhilePaused)
    assert.strictEqual(config.guard.bandBps, 200)
    assert.deepStrictEqual(config.guard.targets, [{ asset: "NVDA", weight: 3000 }, { asset: "USDC", weight: 7000 }])
  })
})
