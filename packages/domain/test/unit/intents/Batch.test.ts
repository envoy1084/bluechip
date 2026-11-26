import { waves } from "@bluechip/domain/intents/Batch"
import type { Leg } from "@bluechip/domain/intents/Intent"
import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

const buyNvda: Leg = { symbol: "NVDA", side: "buy", amount: { usdc: Usdc.make(100_000_000n) } }
const buyAapl: Leg = { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(100_000_000n) } }
const sellTsla: Leg = { symbol: "TSLA", side: "sell", amount: { shares: Shares.make(50_000_000n) } }
const sellNvda: Leg = { symbol: "NVDA", side: "sell", amount: { shares: Shares.make(50_000_000n) } }

describe("waves", () => {
  it.each<{ name: string; legs: ReadonlyArray<Leg>; expected: ReadonlyArray<ReadonlyArray<Leg>> }>([
    { name: "no legs: no operation", legs: [], expected: [] },
    { name: "one leg: one operation", legs: [buyNvda], expected: [[buyNvda]] },
    { name: "two stocks: one operation", legs: [buyNvda, buyAapl], expected: [[buyNvda, buyAapl]] },
    {
      name: "a buy listed before a sell: the sell goes first",
      legs: [buyAapl, sellTsla],
      expected: [[sellTsla, buyAapl]]
    },
    { name: "one stock twice: two operations", legs: [buyNvda, buyNvda], expected: [[buyNvda], [buyNvda]] },
    {
      name: "a split buy beside a sale: the sale rides with the first piece",
      legs: [sellTsla, buyNvda, buyNvda, buyNvda],
      expected: [[sellTsla, buyNvda], [buyNvda], [buyNvda]]
    },
    {
      name: "a buy and a sell of one stock: never in one operation",
      legs: [sellNvda, buyNvda],
      expected: [[sellNvda], [buyNvda]]
    }
  ])("$name", ({ expected, legs }) => {
    assert.deepStrictEqual(waves(legs), expected)
  })

  it("grouped again: the same waves", () => {
    const grouped = waves([buyAapl, buyAapl, sellTsla, buyNvda, sellTsla])

    assert.deepStrictEqual(waves(grouped.flat()), grouped)
  })
})
