import type { Automation } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { settingChips } from "../../../../../src/features/automations/model/settingChips.ts"

const SCHEDULE: Automation["trigger"] = {
  type: "schedule",
  config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" }
}
const NEWS: Automation["trigger"] = { type: "news", config: { symbols: ["NVDA"], topics: [] } }

describe("settingChips", () => {
  it.each([
    {
      name: "a schedule's defaults: its wait only",
      trigger: SCHEDULE,
      settings: DEFAULT_SETTINGS,
      expected: [{ kind: "cooldown", text: "At most once an hour" }]
    },
    {
      name: "no wait says so",
      trigger: SCHEDULE,
      settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 0 },
      expected: [{ kind: "cooldown", text: "No wait between runs" }]
    },
    {
      name: "every setting at once, in the domain's words",
      trigger: SCHEDULE,
      settings: {
        cooldownMinutes: 24 * 60,
        maxFires: 3,
        expiresAt: DateTime.makeUnsafe("2027-02-01T00:00:00Z"),
        quietHours: { from: "22:00", to: "07:00", timeZone: "America/New_York" },
        marketHoursOnly: true,
        actDirectly: false
      },
      expected: [
        { kind: "cooldown", text: "At most once a day" },
        { kind: "maxFires", text: "Up to 3 times" },
        { kind: "expires", text: "Until 1 Feb 2027" },
        { kind: "quietHours", text: "Quiet between 22:00 and 07:00 New York time" },
        { kind: "marketHours", text: "Only while the market is open" }
      ]
    },
    {
      name: "news, only once, asking you first",
      trigger: NEWS,
      settings: { ...DEFAULT_SETTINGS, maxFires: 1 },
      expected: [
        { kind: "cooldown", text: "At most once an hour" },
        { kind: "maxFires", text: "Only once" },
        { kind: "news", text: "Asks you before trading on news" }
      ]
    },
    {
      name: "news trading without asking",
      trigger: NEWS,
      settings: { ...DEFAULT_SETTINGS, actDirectly: true },
      expected: [
        { kind: "cooldown", text: "At most once an hour" },
        { kind: "news", text: "Trades on news without asking you" }
      ]
    }
  ])("$name", ({ expected, settings, trigger }) => {
    assert.deepStrictEqual(settingChips({ trigger, settings }), expected)
  })
})
