import { assert, describe, it } from "@effect/vitest"
import { feedUpdates } from "../../../devnet/sync.ts"

const NOW = 1_795_000_000

describe("feedUpdates", () => {
  it("a priced stock while the market moves: its price, updated now", () => {
    assert.deepStrictEqual(feedUpdates([{ symbol: "NVDA", price: { price: "15279565063" } }], "regular", NOW), [
      { symbol: "NVDA", price: BigInt(15_279_565_063), updatedAt: NOW }
    ])
  })

  it("while prices are paused: updated 30 hours ago", () => {
    assert.deepStrictEqual(feedUpdates([{ symbol: "NVDA", price: { price: "15279565063" } }], "paused", NOW), [
      { symbol: "NVDA", price: BigInt(15_279_565_063), updatedAt: NOW - 108_000 }
    ])
  })

  it("a stock the market has no price for is left as it is", () => {
    assert.deepStrictEqual(feedUpdates([{ symbol: "ANT", price: null }], "regular", NOW), [])
  })

  it("an empty market", () => {
    assert.deepStrictEqual(feedUpdates([], "overnight", NOW), [])
  })
})
