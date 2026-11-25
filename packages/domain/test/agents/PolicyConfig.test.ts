import { Limits, Target } from "@bluechip/domain/agents/Limits"
import { type PolicyConfig, policyConfig } from "@bluechip/domain/agents/PolicyConfig"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

// $250 a day, $100 a trade, ask above $150, 30% in one stock, 10% cash, 12 trades a day, trades while paused.
const PICKER = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

const PICKER_CONFIG: PolicyConfig = {
  trade: {
    stocks: ["NVDA", "AAPL"],
    mode: "both",
    maxUsdcIn: Usdc.make(100_000_000n),
    dailyBudget: Usdc.make(250_000_000n),
    budgetPeriodSeconds: 86_400
  },
  guard: {
    valued: ["AAPL", "AMZN", "ANT", "CRCL", "GOOGL", "INTC", "META", "MSFT", "MSTR", "NVDA", "SNDK", "SPCX", "TSLA"],
    allowed: ["NVDA", "AAPL"],
    mode: "both",
    tradeWhilePaused: true,
    maxTradeUsd: Usdc.make(100_000_000n),
    minTradeUsd: Usdc.make(5_000_000n),
    maxInOneStockBps: 3000,
    cashReserveBps: 1000,
    targets: [],
    collarBps: 100,
    pausedCollarBps: 50,
    liveAgeSeconds: 93_600,
    pausedAgeSeconds: 288_000,
    weeklySlippageBps: 100,
    slippageWindowSeconds: 604_800,
    bandBps: 100,
    overshootBps: 5,
    progressBps: 10
  },
  tradesPerDay: 12,
  expiresAfterSeconds: 7_776_000
}

describe("policyConfig", () => {
  it("a balanced Stock picker: trades its stocks, values them all, caps a trade at the max per trade", () => {
    assert.deepStrictEqual(policyConfig(PICKER), PICKER_CONFIG)
  })

  it("ask-me under the max per trade caps every trade the agent's key signs", () => {
    const config = policyConfig(new Limits({ ...PICKER, askAbove: Usdc.make(50_000_000n) }))

    assert.deepStrictEqual(config, {
      ...PICKER_CONFIG,
      trade: { ...PICKER_CONFIG.trade, maxUsdcIn: Usdc.make(50_000_000n) },
      guard: { ...PICKER_CONFIG.guard, maxTradeUsd: Usdc.make(50_000_000n) }
    })
  })

  it("ask-me at $0 lets the agent's key sign nothing alone", () => {
    const config = policyConfig(new Limits({ ...PICKER, askAbove: Usdc.make(0n) }))

    assert.deepStrictEqual(config, {
      ...PICKER_CONFIG,
      trade: { ...PICKER_CONFIG.trade, maxUsdcIn: Usdc.make(0n) },
      guard: { ...PICKER_CONFIG.guard, maxTradeUsd: Usdc.make(0n) }
    })
  })

  it("relaxed price protection halves to the paused collar", () => {
    const config = policyConfig(new Limits({ ...PICKER, priceProtection: 200 }))

    assert.deepStrictEqual(config, {
      ...PICKER_CONFIG,
      guard: { ...PICKER_CONFIG.guard, collarBps: 200, pausedCollarBps: 100 }
    })
  })

  it("a Rebalancer never trades on paused prices, and carries its targets and band", () => {
    const rebalancer = draftLimits({
      template: "rebalancer",
      preset: "balanced",
      stocks: ["NVDA"],
      targets: [new Target({ asset: "NVDA", weight: 3000 }), new Target({ asset: "USDC", weight: 7000 })]
    })

    const config = policyConfig(new Limits({ ...rebalancer, tradeWhilePaused: true, rebalanceTrigger: 1000 }))

    assert.deepStrictEqual(config, {
      ...PICKER_CONFIG,
      trade: { ...PICKER_CONFIG.trade, stocks: ["NVDA"], mode: "rebalance" },
      guard: {
        ...PICKER_CONFIG.guard,
        allowed: ["NVDA"],
        mode: "rebalance",
        tradeWhilePaused: false,
        targets: [{ asset: "NVDA", weight: 3000 }, { asset: "USDC", weight: 7000 }],
        bandBps: 200
      },
      tradesPerDay: 6
    })
  })
})
