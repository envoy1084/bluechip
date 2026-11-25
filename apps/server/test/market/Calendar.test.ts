import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { marketStatus, priceStatus } from "../../src/market/Calendar.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso)
const iso = (time: DateTime.Utc | null) => (time === null ? null : DateTime.formatIso(time))

const sessionAt = (time: string) => {
  const status = marketStatus(at(time))
  return { session: status.session, changesAt: iso(status.changesAt), pausedFor: status.pausedFor }
}

describe("marketStatus", () => {
  it("walks a winter trading day through its sessions (New York is UTC-5)", () => {
    assert.deepStrictEqual(sessionAt("2026-11-24T08:00:00Z"), {
      session: "overnight",
      changesAt: "2026-11-24T09:00:00.000Z",
      pausedFor: null
    })
    assert.strictEqual(sessionAt("2026-11-24T10:00:00Z").session, "preMarket")
    assert.strictEqual(sessionAt("2026-11-24T15:00:00Z").session, "regular")
    assert.deepStrictEqual(sessionAt("2026-11-24T21:30:00Z"), {
      session: "afterHours",
      changesAt: "2026-11-25T01:00:00.000Z",
      pausedFor: null
    })
    assert.strictEqual(sessionAt("2026-11-25T02:00:00Z").session, "overnight")
  })

  it("knows today's close while regular trading is on, and the next open otherwise", () => {
    const regular = marketStatus(at("2026-11-24T15:00:00Z"))
    assert.strictEqual(iso(regular.opensAt), "2026-11-24T14:30:00.000Z")
    assert.strictEqual(iso(regular.closesAt), "2026-11-24T21:00:00.000Z")
    const evening = marketStatus(at("2026-11-24T22:00:00Z"))
    assert.strictEqual(iso(evening.opensAt), "2026-11-25T14:30:00.000Z")
    assert.isNull(evening.closesAt)
  })

  it("pauses for Thanksgiving, then trades a half day that ends at 1 pm with after-hours until 5 pm", () => {
    assert.deepStrictEqual(sessionAt("2026-11-26T02:00:00Z"), {
      session: "paused",
      changesAt: "2026-11-27T01:00:00.000Z",
      pausedFor: "holiday"
    })
    assert.strictEqual(sessionAt("2026-11-27T02:00:00Z").session, "overnight")
    assert.deepStrictEqual(sessionAt("2026-11-27T18:30:00Z"), {
      session: "afterHours",
      changesAt: "2026-11-27T22:00:00.000Z",
      pausedFor: null
    })
  })

  it("pauses from Friday 8 pm until Sunday 8 pm", () => {
    assert.deepStrictEqual(sessionAt("2026-11-28T16:00:00Z"), {
      session: "paused",
      changesAt: "2026-11-30T01:00:00.000Z",
      pausedFor: "weekend"
    })
    assert.deepStrictEqual(sessionAt("2026-12-05T02:00:00Z"), {
      session: "paused",
      changesAt: "2026-12-07T01:00:00.000Z",
      pausedFor: "weekend"
    })
  })

  it("follows daylight saving time and observed holidays (summer, UTC-4)", () => {
    const regular = marketStatus(at("2026-07-01T13:45:00Z"))
    assert.strictEqual(regular.session, "regular")
    assert.strictEqual(iso(regular.closesAt), "2026-07-01T20:00:00.000Z")
    assert.strictEqual(sessionAt("2026-07-03T15:00:00Z").pausedFor, "holiday")
  })
})

describe("priceStatus", () => {
  const regular = marketStatus(at("2026-11-24T15:00:00Z"))

  it("is live while the feed keeps its 24-hour heartbeat, stale once it misses it", () => {
    assert.strictEqual(priceStatus(regular, at("2026-11-24T14:00:00Z")), "live")
    assert.strictEqual(priceStatus(regular, at("2026-11-23T14:00:00Z")), "stale")
  })

  it("is paused while prices are, whatever the feed's age", () => {
    assert.strictEqual(priceStatus(marketStatus(at("2026-11-28T16:00:00Z")), at("2026-11-21T00:00:00Z")), "paused")
  })
})
