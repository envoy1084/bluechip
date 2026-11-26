import { assert, describe, it } from "@effect/vitest"
import { dayWord, untilText, whenText } from "../../../../../src/features/home/model/time.ts"

const NOW = new Date("2026-11-27T15:00:00Z")

describe("dayWord", () => {
  it.each([
    { name: "later today", at: "2026-11-27T23:59:00Z", expected: "Today" },
    { name: "tomorrow", at: "2026-11-28T00:00:00Z", expected: "Tomorrow" },
    { name: "after that", at: "2026-11-30T10:00:00Z", expected: "Mon 30 Nov" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(dayWord(new Date(at), NOW, "UTC"), expected)
  })

  it("in the viewer's zone: 10:00 UTC tomorrow is already today in Tokyo", () => {
    assert.strictEqual(dayWord(new Date("2026-11-28T10:00:00Z"), NOW, "Asia/Tokyo"), "Today")
  })
})

describe("whenText", () => {
  it.each([
    { name: "today", at: "2026-11-27T21:00:00Z", expected: "at 21:00" },
    { name: "tomorrow", at: "2026-11-28T14:30:00Z", expected: "tomorrow at 14:30" },
    { name: "later", at: "2026-11-30T01:00:00Z", expected: "on Mon 30 Nov at 01:00" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(whenText(new Date(at), NOW, "UTC"), expected)
  })
})

describe("untilText", () => {
  it.each([
    { name: "already here", at: "2026-11-27T15:00:30Z", expected: "now" },
    { name: "minutes", at: "2026-11-27T15:40:00Z", expected: "in 40 min" },
    { name: "hours", at: "2026-11-27T20:00:00Z", expected: "in 5 h" },
    { name: "a day", at: "2026-11-28T15:00:00Z", expected: "tomorrow" },
    { name: "days", at: "2026-11-30T15:00:00Z", expected: "in 3 days" }
  ])("$name", ({ at, expected }) => {
    assert.strictEqual(untilText(new Date(at), NOW), expected)
  })
})
