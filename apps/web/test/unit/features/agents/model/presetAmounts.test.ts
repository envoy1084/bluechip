import { assert, describe, it } from "@effect/vitest"
import { presetAmounts } from "../../../../../src/features/agents/model/presetAmounts.ts"

describe("presetAmounts", () => {
  it("a stock picker: the presets' own amounts", () => {
    assert.deepStrictEqual(presetAmounts("stockPicker"), {
      conservative: { dailySpend: 100, maxPerTrade: 50, maxInOneStock: 20 },
      balanced: { dailySpend: 250, maxPerTrade: 100, maxInOneStock: 30 },
      active: { dailySpend: 1000, maxPerTrade: 400, maxInOneStock: 40 }
    })
  })

  it("a weekly buyer: Active capped at $500 a day", () => {
    assert.deepStrictEqual(presetAmounts("weeklyBuyer"), {
      conservative: { dailySpend: 100, maxPerTrade: 50, maxInOneStock: 20 },
      balanced: { dailySpend: 250, maxPerTrade: 100, maxInOneStock: 30 },
      active: { dailySpend: 500, maxPerTrade: 400, maxInOneStock: 40 }
    })
  })

  it("a stop-loss guard: never buys, no stock cap", () => {
    assert.deepStrictEqual(presetAmounts("stopLossGuard"), {
      conservative: { dailySpend: 0, maxPerTrade: 50 },
      balanced: { dailySpend: 0, maxPerTrade: 100 },
      active: { dailySpend: 0, maxPerTrade: 400 }
    })
  })
})
