import { MarketPrice } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { feedUpdates } from "@bluechip/domain/paper/FeedUpdates"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

describe("feedUpdates", () => {
  it.each(
    [
      {
        name: "no move, written a minute ago: nothing",
        session: "regular",
        price: 15_000_000_000n,
        age: 60,
        push: false
      },
      { name: "moved just under 0.1%: nothing", session: "regular", price: 15_014_999_999n, age: 60, push: false },
      { name: "moved exactly 0.1% up: written", session: "regular", price: 15_015_000_000n, age: 60, push: true },
      { name: "moved 0.1% down: written", session: "regular", price: 14_985_000_000n, age: 60, push: true },
      {
        name: "no move, a second under an hour old: nothing",
        session: "regular",
        price: 15_000_000_000n,
        age: 3599,
        push: false
      },
      { name: "no move, an hour old: written", session: "regular", price: 15_000_000_000n, age: 3600, push: true },
      { name: "moved 5% overnight: written", session: "overnight", price: 15_750_000_000n, age: 60, push: true },
      { name: "moved 5% while paused: nothing", session: "paused", price: 15_750_000_000n, age: 60, push: false },
      { name: "a day old while paused: nothing", session: "paused", price: 15_000_000_000n, age: 86_400, push: false }
    ] as const
  )("$name", ({ age, price, push, session }) => {
    const now = DateTime.makeUnsafe("2026-11-27T15:00:00Z")

    const updates = feedUpdates({
      session,
      now,
      prices: [new MarketPrice({ symbol: "NVDA", price: Price.make(price), tradedAt: now, previousClose: null })],
      feeds: new Map([["NVDA", {
        answer: Price.make(15_000_000_000n),
        updatedAt: DateTime.subtract(now, { seconds: age })
      }]])
    })

    assert.deepStrictEqual(updates, push ? [{ symbol: "NVDA", answer: Price.make(price) }] : [])
  })

  it("a feed never written: written", () => {
    const now = DateTime.makeUnsafe("2026-11-27T15:00:00Z")

    const updates = feedUpdates({
      session: "regular",
      now,
      prices: [
        new MarketPrice({ symbol: "AAPL", price: Price.make(23_000_000_000n), tradedAt: now, previousClose: null })
      ],
      feeds: new Map()
    })

    assert.deepStrictEqual(updates, [{ symbol: "AAPL", answer: Price.make(23_000_000_000n) }])
  })

  it("several stocks: only those that moved, in the prices' order", () => {
    const now = DateTime.makeUnsafe("2026-11-27T15:00:00Z")
    const fresh = { answer: Price.make(10_000_000_000n), updatedAt: now }

    const updates = feedUpdates({
      session: "regular",
      now,
      prices: [
        new MarketPrice({ symbol: "TSLA", price: Price.make(10_100_000_000n), tradedAt: now, previousClose: null }),
        new MarketPrice({ symbol: "AAPL", price: Price.make(10_000_000_000n), tradedAt: now, previousClose: null }),
        new MarketPrice({ symbol: "NVDA", price: Price.make(9_900_000_000n), tradedAt: now, previousClose: null })
      ],
      feeds: new Map([["TSLA", fresh], ["AAPL", fresh], ["NVDA", fresh]])
    })

    assert.deepStrictEqual(updates, [
      { symbol: "TSLA", answer: Price.make(10_100_000_000n) },
      { symbol: "NVDA", answer: Price.make(9_900_000_000n) }
    ])
  })

  it("no market prices yet: nothing", () => {
    const now = DateTime.makeUnsafe("2026-11-27T15:00:00Z")

    assert.deepStrictEqual(feedUpdates({ session: "regular", now, prices: [], feeds: new Map() }), [])
  })
})
