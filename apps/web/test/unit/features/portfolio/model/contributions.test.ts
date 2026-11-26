import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { agentLineDetail, stockLineDetail } from "../../../../../src/features/portfolio/model/contributions.ts"

describe("stockLineDetail", () => {
  it.each([
    {
      name: "held: what it cost and is worth",
      line: {
        shares: Shares.make(100_000_000n),
        cost: Usdc.make(500_000_000n),
        value: Usdc.make(540_000_000n),
        realised: 0n
      },
      expected: "Cost $500.00, worth $540.00"
    },
    {
      name: "sold it all: what it realised",
      line: { shares: Shares.make(0n), cost: Usdc.make(0n), value: Usdc.make(0n), realised: -1_273_280_000n },
      expected: "Sold, realised −$1,273.28"
    }
  ])("$name", ({ expected, line }) => {
    assert.strictEqual(stockLineDetail(line), expected)
  })
})

describe("agentLineDetail", () => {
  it.each([
    { name: "something realised", line: { trades: 6, realised: 12_400_000n }, expected: "6 trades, +$12.40 realised" },
    { name: "nothing realised: its trades alone", line: { trades: 6, realised: 0n }, expected: "6 trades" },
    { name: "one trade", line: { trades: 1, realised: 0n }, expected: "1 trade" }
  ])("$name", ({ expected, line }) => {
    assert.strictEqual(agentLineDetail(line), expected)
  })
})
