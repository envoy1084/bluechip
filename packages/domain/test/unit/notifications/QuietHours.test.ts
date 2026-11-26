import { digestDue, quietUntil } from "@bluechip/domain/notifications/QuietHours"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const NIGHT = { from: "22:00", to: "07:00" }

describe("quietUntil", () => {
  it.each(
    [
      {
        name: "no quiet hours",
        quiet: null,
        severity: "info",
        zone: "UTC",
        at: "2026-11-26T23:30:00Z",
        expected: undefined
      },
      { name: "outside them", quiet: NIGHT, severity: "info", at: "2026-11-26T12:00:00Z", expected: undefined },
      {
        name: "at their start",
        quiet: NIGHT,
        severity: "info",
        at: "2026-11-26T22:00:00Z",
        expected: "2026-11-27T07:00:00.000Z"
      },
      {
        name: "after midnight",
        quiet: NIGHT,
        severity: "important",
        at: "2026-11-27T06:59:30Z",
        expected: "2026-11-27T07:00:00.000Z"
      },
      { name: "at their end", quiet: NIGHT, severity: "info", at: "2026-11-27T07:00:00Z", expected: undefined },
      { name: "security", quiet: NIGHT, severity: "security", at: "2026-11-26T23:30:00Z", expected: undefined },
      {
        name: "in another zone (New York, 23:30 local)",
        quiet: NIGHT,
        zone: "America/New_York",
        severity: "info",
        at: "2026-11-27T04:30:00Z",
        expected: "2026-11-27T12:00:00.000Z"
      },
      {
        name: "a window within one day",
        quiet: { from: "12:00", to: "14:00" },
        severity: "info",
        at: "2026-11-26T13:15:00Z",
        expected: "2026-11-26T14:00:00.000Z"
      }
    ] as const
  )("$name", (example) => {
    const { at, expected, quiet, severity } = example
    const until = quietUntil(quiet, severity, DateTime.makeUnsafe(at), "zone" in example ? example.zone : "UTC")
    assert.strictEqual(until === undefined ? undefined : DateTime.formatIso(until), expected)
  })
})

describe("digestDue", () => {
  it.each(
    [
      { name: "08:00 UTC, in UTC", zone: "UTC", at: "2026-11-26T08:00:00Z", expected: "2026-11-26" },
      { name: "08:59 UTC, in UTC", zone: "UTC", at: "2026-11-26T08:59:59Z", expected: "2026-11-26" },
      { name: "09:00 UTC, in UTC", zone: "UTC", at: "2026-11-26T09:00:00Z", expected: undefined },
      { name: "07:59 UTC, in UTC", zone: "UTC", at: "2026-11-26T07:59:59Z", expected: undefined },
      {
        name: "08:00 UTC, in New York (03:00 there)",
        zone: "America/New_York",
        at: "2026-11-26T08:00:00Z",
        expected: undefined
      },
      {
        name: "13:00 UTC, in New York (08:00 there)",
        zone: "America/New_York",
        at: "2026-11-26T13:00:00Z",
        expected: "2026-11-26"
      },
      {
        name: "22:30 UTC, in Tokyo (07:30 the next day)",
        zone: "Asia/Tokyo",
        at: "2026-11-26T22:30:00Z",
        expected: undefined
      },
      {
        name: "23:30 UTC, in Tokyo (08:30 the next day)",
        zone: "Asia/Tokyo",
        at: "2026-11-26T23:30:00Z",
        expected: "2026-11-27"
      },
      { name: "an unknown zone: UTC", zone: "Mars/Olympus", at: "2026-11-26T08:10:00Z", expected: "2026-11-26" }
    ] as const
  )("$name", ({ at, expected, zone }) => {
    assert.strictEqual(digestDue(DateTime.makeUnsafe(at), zone), expected)
  })
})
