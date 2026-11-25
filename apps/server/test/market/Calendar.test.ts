import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { feedsPaused, marketStatus, priceStatus } from "../../src/market/Calendar.ts"

const at = (iso: string) => DateTime.makeUnsafe(iso)
const iso = (time: DateTime.Utc | null) => (time === null ? null : DateTime.formatIso(time))

describe("marketStatus", () => {
  it("is open during a regular session (winter, New York is UTC-5)", () => {
    const status = marketStatus(at("2026-11-24T15:00:00Z")) // Tuesday 10:00 ET
    assert.strictEqual(status.state, "open")
    assert.strictEqual(iso(status.closesAt), "2026-11-24T21:00:00.000Z")
  })

  it("opens at 9:30 and closes at 16:00 New York time", () => {
    const before = marketStatus(at("2026-11-24T14:00:00Z"))
    assert.strictEqual(before.reason, "beforeOpen")
    assert.strictEqual(iso(before.opensAt), "2026-11-24T14:30:00.000Z")
    const after = marketStatus(at("2026-11-24T21:30:00Z"))
    assert.strictEqual(after.reason, "afterClose")
    assert.strictEqual(iso(after.opensAt), "2026-11-25T14:30:00.000Z")
  })

  it("is closed on Thanksgiving and closes at 1:00 pm the day after", () => {
    const thanksgiving = marketStatus(at("2026-11-26T15:00:00Z"))
    assert.strictEqual(thanksgiving.reason, "holiday")
    assert.strictEqual(iso(thanksgiving.opensAt), "2026-11-27T14:30:00.000Z")
    const halfDay = marketStatus(at("2026-11-27T17:30:00Z"))
    assert.strictEqual(halfDay.state, "open")
    assert.strictEqual(iso(halfDay.closesAt), "2026-11-27T18:00:00.000Z")
    const closed = marketStatus(at("2026-11-27T18:30:00Z"))
    assert.strictEqual(closed.reason, "afterClose")
    assert.strictEqual(iso(closed.opensAt), "2026-11-30T14:30:00.000Z")
  })

  it("is closed on weekends until Monday's open", () => {
    const saturday = marketStatus(at("2026-11-28T16:00:00Z"))
    assert.strictEqual(saturday.reason, "weekend")
    assert.strictEqual(iso(saturday.opensAt), "2026-11-30T14:30:00.000Z")
  })

  it("follows daylight saving time and observed holidays (summer, UTC-4)", () => {
    const open = marketStatus(at("2026-07-01T13:45:00Z")) // Wednesday 9:45 EDT
    assert.strictEqual(open.state, "open")
    assert.strictEqual(iso(open.closesAt), "2026-07-01T20:00:00.000Z")
    const observed = marketStatus(at("2026-07-03T15:00:00Z")) // Independence Day observed on Friday
    assert.strictEqual(observed.reason, "holiday")
    assert.strictEqual(iso(observed.opensAt), "2026-07-06T13:30:00.000Z")
  })
})

describe("priceStatus", () => {
  const open = marketStatus(at("2026-11-24T15:00:00Z"))

  it("is live while the market is open and the feed keeps its heartbeat", () => {
    assert.strictEqual(priceStatus(open, at("2026-11-24T14:00:00Z")), "live")
  })

  it("is stale when the market is open but the feed missed its 24-hour heartbeat", () => {
    assert.strictEqual(priceStatus(open, at("2026-11-23T14:00:00Z")), "stale")
  })

  it("stays live outside regular hours on weekdays, as the feeds run 24/5", () => {
    const overnight = marketStatus(at("2026-11-25T05:00:00Z")) // Wednesday 0:00 ET
    assert.strictEqual(overnight.state, "closed")
    assert.strictEqual(priceStatus(overnight, at("2026-11-25T04:45:00Z")), "live")
  })

  it("is the last close on weekends and holidays", () => {
    assert.strictEqual(priceStatus(marketStatus(at("2026-11-28T16:00:00Z")), at("2026-11-20T21:00:00Z")), "closed")
  })
})

describe("feedsPaused", () => {
  it("pauses polling on weekends and holidays only", () => {
    assert.isTrue(feedsPaused(at("2026-11-28T16:00:00Z"))) // Saturday
    assert.isTrue(feedsPaused(at("2026-11-26T16:00:00Z"))) // Thanksgiving
    assert.isFalse(feedsPaused(at("2026-11-25T05:00:00Z"))) // Wednesday overnight: the feeds run 24/5
    assert.isFalse(feedsPaused(at("2026-11-24T15:00:00Z"))) // Tuesday, market open
  })
})
