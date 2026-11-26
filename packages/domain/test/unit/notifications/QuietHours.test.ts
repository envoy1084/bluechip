import { quietUntil } from "@bluechip/domain/notifications/QuietHours"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const NIGHT = { from: "22:00", to: "07:00", zone: "UTC" }

describe("quietUntil", () => {
  it.each(
    [
      { name: "no quiet hours", quiet: null, severity: "info", at: "2026-11-26T23:30:00Z", expected: undefined },
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
        quiet: { ...NIGHT, zone: "America/New_York" },
        severity: "info",
        at: "2026-11-27T04:30:00Z",
        expected: "2026-11-27T12:00:00.000Z"
      },
      {
        name: "a window within one day",
        quiet: { from: "12:00", to: "14:00", zone: "UTC" },
        severity: "info",
        at: "2026-11-26T13:15:00Z",
        expected: "2026-11-26T14:00:00.000Z"
      }
    ] as const
  )("$name", ({ at, expected, quiet, severity }) => {
    const until = quietUntil(quiet, severity, DateTime.makeUnsafe(at))
    assert.strictEqual(until === undefined ? undefined : DateTime.formatIso(until), expected)
  })
})
