import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { dailyResetText, dayHeading, nextDailyReset, yourDateTime, yourTime } from "../../../src/lib/localTime.ts"

describe("dayHeading", () => {
  it.each<{ name: string; at: string; timeZone: string; expected: string }>([
    { name: "earlier today", at: "2026-11-26T01:00:00Z", timeZone: "UTC", expected: "Today" },
    { name: "late yesterday", at: "2026-11-25T23:59:00Z", timeZone: "UTC", expected: "Yesterday" },
    { name: "two days ago: the date", at: "2026-11-24T10:00:00Z", timeZone: "UTC", expected: "Tue 24 Nov" },
    {
      name: "yesterday in UTC, today in India",
      at: "2026-11-25T20:00:00Z",
      timeZone: "Asia/Kolkata",
      expected: "Today"
    }
  ])("$name", ({ at, expected, timeZone }) => {
    assert.strictEqual(dayHeading(DateTime.makeUnsafe(at), new Date("2026-11-26T12:00:00Z"), timeZone), expected)
  })
})

describe("yourTime", () => {
  it.each<{ name: string; timeZone: string; expected: string }>([
    { name: "in UTC", timeZone: "UTC", expected: "20:30 your time" },
    { name: "in India", timeZone: "Asia/Kolkata", expected: "02:00 your time" }
  ])("$name", ({ expected, timeZone }) => {
    assert.strictEqual(yourTime(new Date("2026-11-27T20:30:00Z"), timeZone), expected)
  })
})

describe("yourDateTime", () => {
  it("the next day in India", () => {
    assert.strictEqual(yourDateTime(new Date("2026-11-27T20:30:00Z"), "Asia/Kolkata"), "Sat 28 Nov, 02:00 your time")
  })
})

describe("nextDailyReset", () => {
  it.each<{ name: string; now: string; expected: string }>([
    { name: "midday", now: "2026-11-26T12:00:00Z", expected: "2026-11-27T00:00:00.000Z" },
    { name: "at midnight: the next one", now: "2026-11-26T00:00:00Z", expected: "2026-11-27T00:00:00.000Z" },
    { name: "a moment before midnight", now: "2026-11-26T23:59:59Z", expected: "2026-11-27T00:00:00.000Z" }
  ])("$name", ({ expected, now }) => {
    assert.strictEqual(nextDailyReset(new Date(now)).toISOString(), expected)
  })
})

describe("dailyResetText", () => {
  it.each<{ name: string; timeZone: string; expected: string }>([
    { name: "in UTC", timeZone: "UTC", expected: "00:00 your time, midnight UTC" },
    { name: "in India", timeZone: "Asia/Kolkata", expected: "05:30 your time, midnight UTC" }
  ])("$name", ({ expected, timeZone }) => {
    assert.strictEqual(dailyResetText(new Date("2026-11-26T12:00:00Z"), timeZone), expected)
  })
})
