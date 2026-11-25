import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { marketStatus, priceStatus } from "../../../../src/modules/market/Calendar.ts"

describe("marketStatus", () => {
  describe("the session at a time, when it changes and why prices pause", () => {
    it.each([
      {
        name: "a winter night before a trading day is overnight trading (New York is UTC-5)",
        at: "2026-11-24T08:00:00Z",
        expected: { session: "overnight", changesAt: "2026-11-24T09:00:00.000Z", pausedFor: null }
      },
      {
        name: "4 am to the opening bell is pre-market",
        at: "2026-11-24T10:00:00Z",
        expected: { session: "preMarket", changesAt: "2026-11-24T14:30:00.000Z", pausedFor: null }
      },
      {
        name: "9:30 am to 4 pm is regular trading",
        at: "2026-11-24T15:00:00Z",
        expected: { session: "regular", changesAt: "2026-11-24T21:00:00.000Z", pausedFor: null }
      },
      {
        name: "4 pm to 8 pm is after-hours",
        at: "2026-11-24T21:30:00Z",
        expected: { session: "afterHours", changesAt: "2026-11-25T01:00:00.000Z", pausedFor: null }
      },
      {
        name: "after 8 pm is overnight trading again",
        at: "2026-11-25T02:00:00Z",
        expected: { session: "overnight", changesAt: "2026-11-25T09:00:00.000Z", pausedFor: null }
      },
      {
        name: "the night before Thanksgiving is paused for the holiday",
        at: "2026-11-26T02:00:00Z",
        expected: { session: "paused", changesAt: "2026-11-27T01:00:00.000Z", pausedFor: "holiday" }
      },
      {
        name: "Thanksgiving night trades overnight again",
        at: "2026-11-27T02:00:00Z",
        expected: { session: "overnight", changesAt: "2026-11-27T09:00:00.000Z", pausedFor: null }
      },
      {
        name: "the half day after Thanksgiving ends at 1 pm, with after-hours until 5 pm",
        at: "2026-11-27T18:30:00Z",
        expected: { session: "afterHours", changesAt: "2026-11-27T22:00:00.000Z", pausedFor: null }
      },
      {
        name: "a Saturday is paused until Sunday 8 pm",
        at: "2026-11-28T16:00:00Z",
        expected: { session: "paused", changesAt: "2026-11-30T01:00:00.000Z", pausedFor: "weekend" }
      },
      {
        name: "Friday after 8 pm is paused until Sunday 8 pm",
        at: "2026-12-05T02:00:00Z",
        expected: { session: "paused", changesAt: "2026-12-07T01:00:00.000Z", pausedFor: "weekend" }
      }
    ])("$name", ({ at, expected }) => {
      const status = marketStatus(DateTime.makeUnsafe(at))

      assert.deepStrictEqual(
        { session: status.session, changesAt: DateTime.formatIso(status.changesAt), pausedFor: status.pausedFor },
        expected
      )
    })
  })

  it("knows today's close while regular trading is on", () => {
    const status = marketStatus(DateTime.makeUnsafe("2026-11-24T15:00:00Z"))

    assert.deepStrictEqual(
      [DateTime.formatIso(status.opensAt), status.closesAt && DateTime.formatIso(status.closesAt)],
      [
        "2026-11-24T14:30:00.000Z",
        "2026-11-24T21:00:00.000Z"
      ]
    )
  })

  it("knows the next open, and no close, once regular trading is over", () => {
    const status = marketStatus(DateTime.makeUnsafe("2026-11-24T22:00:00Z"))

    assert.deepStrictEqual([DateTime.formatIso(status.opensAt), status.closesAt], ["2026-11-25T14:30:00.000Z", null])
  })

  it("follows daylight saving time in summer (UTC-4)", () => {
    const status = marketStatus(DateTime.makeUnsafe("2026-07-01T13:45:00Z"))

    assert.deepStrictEqual([status.session, status.closesAt && DateTime.formatIso(status.closesAt)], [
      "regular",
      "2026-07-01T20:00:00.000Z"
    ])
  })

  it("pauses for an observed holiday (Independence Day on a Saturday, observed Friday)", () => {
    const status = marketStatus(DateTime.makeUnsafe("2026-07-03T15:00:00Z"))

    assert.deepStrictEqual([status.session, status.pausedFor], ["paused", "holiday"])
  })
})

describe("priceStatus", () => {
  it.each([
    { name: "live while the feed keeps its 24-hour heartbeat", updatedAt: "2026-11-24T14:00:00Z", expected: "live" },
    { name: "stale once it misses it", updatedAt: "2026-11-23T14:00:00Z", expected: "stale" }
  ])("during regular trading, $name", ({ expected, updatedAt }) => {
    const regular = marketStatus(DateTime.makeUnsafe("2026-11-24T15:00:00Z"))

    assert.strictEqual(priceStatus(regular, DateTime.makeUnsafe(updatedAt)), expected)
  })

  it("is paused while prices are, whatever the feed's age", () => {
    const weekend = marketStatus(DateTime.makeUnsafe("2026-11-28T16:00:00Z"))

    assert.strictEqual(priceStatus(weekend, DateTime.makeUnsafe("2026-11-21T00:00:00Z")), "paused")
  })
})
