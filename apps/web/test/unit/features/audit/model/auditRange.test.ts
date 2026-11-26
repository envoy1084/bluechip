import { assert, describe, it } from "@effect/vitest"
import { auditDays, localDay } from "../../../../../src/features/audit/model/auditRange.ts"

describe("auditDays", () => {
  it.each(
    [
      { preset: "any", expected: { from: null, to: null } },
      { preset: "today", expected: { from: "2026-11-27", to: "2026-11-27" } },
      { preset: "7d", expected: { from: "2026-11-21", to: "2026-11-27" } },
      { preset: "30d", expected: { from: "2026-10-29", to: "2026-11-27" } },
      { preset: "custom", expected: { from: "2026-11-01", to: null } }
    ] as const
  )("$preset", ({ expected, preset }) => {
    assert.deepStrictEqual(auditDays(preset, "2026-11-27", { from: "2026-11-01", to: null }), expected)
  })

  it("counts back across a month and a year", () => {
    assert.deepStrictEqual(auditDays("7d", "2026-01-03", { from: null, to: null }), {
      from: "2025-12-28",
      to: "2026-01-03"
    })
  })
})

describe("localDay", () => {
  it.each([
    { timeZone: "UTC", expected: "2026-11-27" },
    { timeZone: "Asia/Tokyo", expected: "2026-11-28" },
    { timeZone: "America/Los_Angeles", expected: "2026-11-27" }
  ])("$timeZone", ({ expected, timeZone }) => {
    assert.strictEqual(localDay(new Date("2026-11-27T20:00:00Z"), timeZone), expected)
  })
})
