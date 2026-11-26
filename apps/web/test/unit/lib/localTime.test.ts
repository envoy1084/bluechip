import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { dayHeading } from "../../../src/lib/localTime.ts"

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
