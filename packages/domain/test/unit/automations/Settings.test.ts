import { DEFAULT_SETTINGS, gate, type Settings } from "@bluechip/domain/automations/Settings"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

const NOW = DateTime.makeUnsafe("2026-11-30T15:00:00Z")

const state = {
  active: true,
  fires: 0,
  lastFiredAt: null as DateTime.Utc | null,
  now: NOW,
  marketOpen: true,
  marketHours: true
}

describe("gate", () => {
  it.each<{ name: string; settings?: Partial<Settings>; changes?: Partial<typeof state>; expected: string | null }>([
    { name: "a first fire with the default settings", expected: null },
    { name: "a paused automation", changes: { active: false }, expected: "inactive" },
    {
      name: "59 minutes after the last fire",
      changes: { lastFiredAt: DateTime.subtract(NOW, { minutes: 59 }) },
      expected: "cooldown"
    },
    {
      name: "60 minutes after the last fire",
      changes: { lastFiredAt: DateTime.subtract(NOW, { minutes: 60 }) },
      expected: null
    },
    { name: "its third fire of 3", settings: { maxFires: 3 }, changes: { fires: 2 }, expected: null },
    { name: "after its 3 fires", settings: { maxFires: 3 }, changes: { fires: 3 }, expected: "done" },
    { name: "at its expiry", settings: { expiresAt: NOW }, expected: "expired" },
    { name: "a minute before its expiry", settings: { expiresAt: DateTime.add(NOW, { minutes: 1 }) }, expected: null },
    {
      name: "in quiet hours (10:00 New York, quiet 09:00 to 11:00)",
      settings: { quietHours: { from: "09:00", to: "11:00", timeZone: "America/New_York" } },
      expected: "quietHours"
    },
    { name: "a price trigger while the market is closed", changes: { marketOpen: false }, expected: "marketClosed" },
    {
      name: "a schedule while the market is closed",
      changes: { marketOpen: false, marketHours: false },
      expected: null
    },
    {
      name: "a price trigger set to fire around the clock",
      settings: { marketHoursOnly: false },
      changes: { marketOpen: false },
      expected: null
    }
  ])("$name", ({ changes, expected, settings }) => {
    assert.strictEqual(gate({ ...DEFAULT_SETTINGS, ...settings }, { ...state, ...changes }), expected)
  })
})
