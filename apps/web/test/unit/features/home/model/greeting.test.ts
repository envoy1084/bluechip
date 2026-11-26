import { MarketStatus } from "@bluechip/domain/market/Market"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { greeting, marketLine, todayLabel } from "../../../../../src/features/home/model/greeting.ts"

const NOW = new Date("2026-11-27T15:00:00Z")

describe("greeting", () => {
  it.each([
    { name: "before noon", now: "2026-11-27T11:59:00Z", displayName: null, expected: "Good morning" },
    { name: "at noon", now: "2026-11-27T12:00:00Z", displayName: null, expected: "Good afternoon" },
    { name: "at 6 pm", now: "2026-11-27T18:00:00Z", displayName: null, expected: "Good evening" },
    { name: "with a first name", now: "2026-11-27T09:00:00Z", displayName: "Ada", expected: "Good morning, Ada" },
    {
      name: "with a full name: the first only",
      now: "2026-11-27T09:00:00Z",
      displayName: "Sam Rivera",
      expected: "Good morning, Sam"
    },
    { name: "with a blank name", now: "2026-11-27T09:00:00Z", displayName: "  ", expected: "Good morning" }
  ])("$name", ({ displayName, expected, now }) => {
    assert.strictEqual(greeting(new Date(now), displayName, "UTC"), expected)
  })

  it("in the viewer's zone", () => {
    assert.strictEqual(greeting(new Date("2026-11-27T15:00:00Z"), null, "Asia/Tokyo"), "Good morning")
  })
})

describe("todayLabel", () => {
  it("the weekday, day and month", () => {
    assert.strictEqual(todayLabel(NOW, "UTC"), "Friday 27 November")
  })
})

describe("marketLine", () => {
  const status = (fields: Partial<ConstructorParameters<typeof MarketStatus>[0]>) =>
    new MarketStatus({
      session: "regular",
      pausedFor: null,
      changesAt: DateTime.makeUnsafe("2026-11-27T21:00:00Z"),
      opensAt: DateTime.makeUnsafe("2026-11-27T14:30:00Z"),
      closesAt: DateTime.makeUnsafe("2026-11-27T21:00:00Z"),
      asOf: DateTime.makeUnsafe(NOW),
      ...fields
    })

  it.each([
    { name: "open, closing today", fields: {}, expected: "The US market is open and closes at 21:00." },
    { name: "open with no close known", fields: { closesAt: null }, expected: "The US market is open." },
    {
      name: "pre-market, opening today",
      fields: { session: "preMarket" as const, closesAt: null },
      expected: "Pre-market trading now. The market opens at 14:30."
    },
    {
      name: "overnight, opening tomorrow",
      fields: { session: "overnight" as const, opensAt: DateTime.makeUnsafe("2026-11-28T14:30:00Z"), closesAt: null },
      expected: "Overnight trading now. The market opens tomorrow at 14:30."
    },
    {
      name: "paused for the weekend",
      fields: {
        session: "paused" as const,
        pausedFor: "weekend" as const,
        changesAt: DateTime.makeUnsafe("2026-11-30T01:00:00Z"),
        closesAt: null
      },
      expected: "Prices are paused for the weekend and start again on Mon 30 Nov at 01:00."
    },
    {
      name: "paused with no reason",
      fields: { session: "paused" as const, changesAt: DateTime.makeUnsafe("2026-11-27T22:00:00Z"), closesAt: null },
      expected: "Prices are paused and start again at 22:00."
    }
  ])("$name", ({ expected, fields }) => {
    assert.strictEqual(marketLine(status(fields), NOW, "UTC"), expected)
  })
})
