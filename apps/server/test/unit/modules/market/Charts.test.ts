import { PricePoint } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { pastDay, thin } from "../../../../src/modules/market/Charts.ts"

describe("thin", () => {
  it("leaves short series alone", () => {
    const points = [1, 2, 3].map((price, index) =>
      new PricePoint({ at: DateTime.makeUnsafe(index * 60_000), price: Price.make(BigInt(price)) })
    )

    assert.strictEqual(thin(points), points)
  })

  it("keeps at most 300 points, the ends, and every slice's high and low in time order", () => {
    // A minute-by-minute saw from $100 to $149, with one spike to $1,000 and one dip to $1.
    const points = Array.from({ length: 2600 }, (_, index) =>
      new PricePoint({
        at: DateTime.makeUnsafe(index * 60_000),
        price: Price.make(BigInt(index === 1300 ? 1000 : index === 1800 ? 1 : 100 + (index % 50)))
      }))

    const thinned = thin(points)

    assert.isAtMost(thinned.length, 300)
    assert.deepStrictEqual([thinned[0], thinned.at(-1)], [points[0], points.at(-1)])
    assert.isTrue(thinned.some((point) => point.price === BigInt(1000)))
    assert.isTrue(thinned.some((point) => point.price === BigInt(1)))
    const times = thinned.map((point) => DateTime.toEpochMillis(point.at))
    assert.deepStrictEqual(times, times.toSorted((a, b) => a - b))
  })
})

describe("pastDay", () => {
  it.each([
    {
      name: "before the opening bell, keeps the last trading day and today's pre-market",
      times: [
        "2026-11-23T20:30:00.000Z",
        "2026-11-24T14:30:00.000Z",
        "2026-11-24T22:00:00.000Z",
        "2026-11-25T13:00:00.000Z"
      ],
      expected: ["2026-11-24T14:30:00.000Z", "2026-11-24T22:00:00.000Z", "2026-11-25T13:00:00.000Z"]
    },
    {
      name: "once the market opens, keeps only today",
      times: ["2026-11-24T20:00:00.000Z", "2026-11-25T13:00:00.000Z", "2026-11-25T14:35:00.000Z"],
      expected: ["2026-11-25T13:00:00.000Z", "2026-11-25T14:35:00.000Z"]
    },
    {
      name: "on a Monday morning, reaches back to Friday",
      times: ["2026-11-20T18:00:00.000Z", "2026-11-23T12:00:00.000Z"],
      expected: ["2026-11-20T18:00:00.000Z", "2026-11-23T12:00:00.000Z"]
    }
  ])("$name", ({ expected, times }) => {
    const points = times.map((at) => new PricePoint({ at: DateTime.makeUnsafe(at), price: Price.make(BigInt(1)) }))

    const kept = pastDay(points)

    assert.deepStrictEqual(kept.map((point) => DateTime.formatIso(point.at)), expected)
  })
})
