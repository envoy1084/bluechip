import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import type { Floor } from "@bluechip/domain/policies/StopLossFloor"
import { assert, describe, it } from "@effect/vitest"
import { withFloor } from "../../../../../src/features/agents/model/floors.ts"

describe("withFloor", () => {
  it.each<{
    name: string
    floors: ReadonlyArray<Floor>
    symbol: StockSymbol
    price: Price | null
    expected: ReadonlyArray<Floor>
  }>([
    {
      name: "a first floor",
      floors: [],
      symbol: "AAPL",
      price: Price.make(18_000_000_000n),
      expected: [{ symbol: "AAPL", price: Price.make(18_000_000_000n) }]
    },
    {
      name: "a floor joins in the order of the stocks it trades",
      floors: [{ symbol: "AAPL", price: Price.make(18_000_000_000n) }],
      symbol: "NVDA",
      price: Price.make(15_000_000_000n),
      expected: [
        { symbol: "NVDA", price: Price.make(15_000_000_000n) },
        { symbol: "AAPL", price: Price.make(18_000_000_000n) }
      ]
    },
    {
      name: "a floor changes in place",
      floors: [{ symbol: "NVDA", price: Price.make(15_000_000_000n) }],
      symbol: "NVDA",
      price: Price.make(14_050_000_000n),
      expected: [{ symbol: "NVDA", price: Price.make(14_050_000_000n) }]
    },
    {
      name: "a floor cleared is left out",
      floors: [
        { symbol: "NVDA", price: Price.make(15_000_000_000n) },
        { symbol: "AAPL", price: Price.make(18_000_000_000n) }
      ],
      symbol: "NVDA",
      price: null,
      expected: [{ symbol: "AAPL", price: Price.make(18_000_000_000n) }]
    },
    {
      name: "a floor of a stock it no longer trades is dropped",
      floors: [{ symbol: "MSFT", price: Price.make(40_000_000_000n) }],
      symbol: "AAPL",
      price: Price.make(18_000_000_000n),
      expected: [{ symbol: "AAPL", price: Price.make(18_000_000_000n) }]
    }
  ])("$name", ({ floors, symbol, price, expected }) => {
    assert.deepStrictEqual(withFloor(floors, ["NVDA", "AAPL"], symbol, price), expected)
  })
})
