import { PricePoint } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { pastDay, thin } from "../../src/market/Charts.ts"

const series = (prices: ReadonlyArray<number>) =>
  prices.map((price, index) =>
    new PricePoint({ at: DateTime.makeUnsafe(index * 60_000), price: Price.make(BigInt(price)) })
  )

describe("thin", () => {
  it("leaves short series alone", () => {
    const points = series([1, 2, 3])
    assert.strictEqual(thin(points), points)
  })

  it("keeps at most 300 points, the ends, and every slice's high and low in time order", () => {
    const prices = Array.from({ length: 2600 }, (_, index) => 100 + (index % 50))
    prices[1300] = 1000
    prices[1800] = 1
    const thinned = thin(series(prices))

    assert.isAtMost(thinned.length, 300)
    assert.strictEqual(thinned[0]!.price, BigInt(100))
    assert.strictEqual(thinned.at(-1)!.price, BigInt(prices.at(-1)!))
    assert.isTrue(thinned.some((point) => point.price === BigInt(1000)))
    assert.isTrue(thinned.some((point) => point.price === BigInt(1)))
    const times = thinned.map((point) => DateTime.toEpochMillis(point.at))
    assert.deepStrictEqual(times, [...times].sort((a, b) => a - b))
  })
})

describe("pastDay", () => {
  const at = (iso: string) => new PricePoint({ at: DateTime.makeUnsafe(iso), price: Price.make(BigInt(1)) })
  const times = (points: ReadonlyArray<PricePoint>) => points.map((point) => DateTime.formatIso(point.at))

  it("before the opening bell, keeps the last trading day and today's pre-market", () => {
    const points = [
      at("2026-11-23T20:30:00.000Z"),
      at("2026-11-24T14:30:00.000Z"),
      at("2026-11-24T22:00:00.000Z"),
      at("2026-11-25T13:00:00.000Z")
    ]
    assert.deepStrictEqual(times(pastDay(points)), times(points.slice(1)))
  })

  it("once the market opens, keeps only today", () => {
    const points = [at("2026-11-24T20:00:00.000Z"), at("2026-11-25T13:00:00.000Z"), at("2026-11-25T14:35:00.000Z")]
    assert.deepStrictEqual(times(pastDay(points)), times(points.slice(1)))
  })

  it("on a Monday morning, reaches back to Friday", () => {
    const points = [at("2026-11-20T18:00:00.000Z"), at("2026-11-23T12:00:00.000Z")]
    assert.deepStrictEqual(times(pastDay(points)), times(points))
  })
})
