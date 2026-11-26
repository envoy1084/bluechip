import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { profitRanges, valueRanges } from "../../../../../src/features/portfolio/model/chartRanges.ts"

describe("valueRanges", () => {
  it("no snapshots: the month alone, empty", () => {
    assert.deepStrictEqual(valueRanges([]), [{ id: "1M", description: "Past 30 days", points: [] }])
  })

  it("snapshots all within the week: the month alone", () => {
    const points = [
      { at: DateTime.makeUnsafe("2026-11-26T08:00:00Z"), value: 1_000_000_000n },
      { at: DateTime.makeUnsafe("2026-11-26T12:00:00Z"), value: 1_012_500_000n }
    ]

    assert.deepStrictEqual(valueRanges(points), [{
      id: "1M",
      description: "Past 30 days",
      points: [{ value: 1000, label: "Thu 26 Nov, 08:00" }, { value: 1012.5, label: "Thu 26 Nov, 12:00" }]
    }])
  })

  it("snapshots older than a week: the week, from exactly 7 days back, then the month", () => {
    const points = [
      { at: DateTime.makeUnsafe("2026-11-01T12:00:00Z"), value: 900_000_000n },
      { at: DateTime.makeUnsafe("2026-11-19T11:59:00Z"), value: 950_000_000n },
      { at: DateTime.makeUnsafe("2026-11-19T12:00:00Z"), value: 960_000_000n },
      { at: DateTime.makeUnsafe("2026-11-26T12:00:00Z"), value: 1_000_000_000n }
    ]

    assert.deepStrictEqual(valueRanges(points), [
      {
        id: "1W",
        description: "Past week",
        points: [{ value: 960, label: "Thu 19 Nov, 12:00" }, { value: 1000, label: "Thu 26 Nov, 12:00" }]
      },
      {
        id: "1M",
        description: "Past 30 days",
        points: [
          { value: 900, label: "Sun 1 Nov, 12:00" },
          { value: 950, label: "Thu 19 Nov, 11:59" },
          { value: 960, label: "Thu 19 Nov, 12:00" },
          { value: 1000, label: "Thu 26 Nov, 12:00" }
        ]
      }
    ])
  })

  it("a single snapshot in the week: the month alone", () => {
    const points = [
      { at: DateTime.makeUnsafe("2026-11-01T12:00:00Z"), value: 900_000_000n },
      { at: DateTime.makeUnsafe("2026-11-26T12:00:00Z"), value: 1_000_000_000n }
    ]

    assert.deepStrictEqual(valueRanges(points).map((range) => range.id), ["1M"])
  })
})

describe("profitRanges", () => {
  it("no days: all of it, empty", () => {
    assert.deepStrictEqual(profitRanges([]), [{ id: "All", description: "Since your first trade", points: [] }])
  })

  it("30 days or fewer: all of it", () => {
    const series = [
      { day: "2026-10-28", total: -2_500_000n },
      { day: "2026-11-26", total: 4_000_000n }
    ]

    assert.deepStrictEqual(profitRanges(series), [{
      id: "All",
      description: "Since your first trade",
      points: [{ value: -2.5, label: "Wed 28 Oct" }, { value: 4, label: "Thu 26 Nov" }]
    }])
  })

  it("more than 30 days: the past 30, then all of it", () => {
    const series = [
      { day: "2026-10-27", total: -1_000_000n },
      { day: "2026-10-28", total: -2_500_000n },
      { day: "2026-11-26", total: 4_000_000n }
    ]

    assert.deepStrictEqual(profitRanges(series), [
      {
        id: "1M",
        description: "Past 30 days",
        points: [{ value: -2.5, label: "Wed 28 Oct" }, { value: 4, label: "Thu 26 Nov" }]
      },
      {
        id: "All",
        description: "Since your first trade",
        points: [
          { value: -1, label: "Tue 27 Oct" },
          { value: -2.5, label: "Wed 28 Oct" },
          { value: 4, label: "Thu 26 Nov" }
        ]
      }
    ])
  })
})
