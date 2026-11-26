import { Bps, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Holding } from "@bluechip/domain/portfolio/Portfolio"
import { assert, describe, it } from "@effect/vitest"
import { moneySummary } from "../../../src/lib/moneySummary.ts"

describe("moneySummary", () => {
  it("a portfolio up $40 today: dollars, the move against yesterday's value, each holding by name", () => {
    const portfolio = {
      value: Usdc.make(1_040_000_000n),
      cash: Usdc.make(240_000_000n),
      change24h: 40_000_000n,
      holdings: [
        new Holding({
          symbol: "NVDA",
          shares: Shares.make(500_000_000n),
          price: null,
          value: Usdc.make(800_000_000n),
          weightBps: Bps.make(7692),
          change24h: null
        })
      ]
    }

    assert.deepStrictEqual(moneySummary(portfolio, () => "Nvidia"), {
      value: 1040,
      dayChange: 40,
      dayChangePercent: 4,
      cash: 240,
      positions: [{ symbol: "NVDA", name: "Nvidia", value: 800 }]
    })
  })

  it("empty money moved nothing", () => {
    const portfolio = { value: Usdc.make(0n), cash: Usdc.make(0n), change24h: 0n, holdings: [] }

    assert.deepStrictEqual(moneySummary(portfolio, () => ""), {
      value: 0,
      dayChange: 0,
      dayChangePercent: 0,
      cash: 0,
      positions: []
    })
  })
})
