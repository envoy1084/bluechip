import { nextRun } from "@bluechip/domain/automations/triggers/Schedule"
import type { ScheduleConfig } from "@bluechip/domain/automations/triggers/Schedule"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

describe("nextRun", () => {
  it.each<{ name: string; config: ScheduleConfig; after: string; expected: string }>([
    {
      name: "every Monday at 10:00 New York time, from the Sunday before",
      config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" },
      after: "2026-11-29T12:00:00Z",
      expected: "2026-11-30T15:00:00.000Z"
    },
    {
      name: "every Monday, from that Monday's 10:00 itself: the next week",
      config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" },
      after: "2026-11-30T15:00:00Z",
      expected: "2026-12-07T15:00:00.000Z"
    },
    {
      name: "every Monday, from a minute before it",
      config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" },
      after: "2026-11-30T14:59:00Z",
      expected: "2026-11-30T15:00:00.000Z"
    },
    {
      name: "every day at 09:30 New York time across the switch to summer time",
      config: { days: [], time: "09:30", timeZone: "America/New_York" },
      after: "2027-03-13T15:00:00Z",
      expected: "2027-03-14T13:30:00.000Z"
    },
    {
      name: "weekdays at 15:00 UTC, from a Friday afternoon",
      config: {
        days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        time: "15:00",
        timeZone: "UTC"
      },
      after: "2026-12-04T16:00:00Z",
      expected: "2026-12-07T15:00:00.000Z"
    }
  ])("$name", ({ after, config, expected }) => {
    assert.strictEqual(DateTime.formatIso(nextRun(config, DateTime.makeUnsafe(after))), expected)
  })
})
