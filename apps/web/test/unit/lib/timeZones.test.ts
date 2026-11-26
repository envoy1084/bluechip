import { assert, describe, it } from "@effect/vitest"
import { timeZones, zoneLabel } from "../../../src/lib/timeZones.ts"

describe("timeZones", () => {
  it.each([
    {
      name: "another zone is offered as yours",
      local: "Europe/London",
      expected: ["America/New_York", "Europe/London", "UTC"]
    },
    { name: "in New York, the market's is yours", local: "America/New_York", expected: ["America/New_York", "UTC"] },
    { name: "in UTC, no zone twice", local: "UTC", expected: ["America/New_York", "UTC"] }
  ])("$name", ({ local, expected }) => {
    assert.deepStrictEqual(timeZones(local).map((option) => option.zone), expected)
  })
})

describe("zoneLabel", () => {
  it.each([
    { zone: "Asia/Kolkata", expected: "Kolkata" },
    { zone: "America/New_York", expected: "New York" },
    { zone: "America/Argentina/Buenos_Aires", expected: "Buenos Aires" },
    { zone: "UTC", expected: "UTC" },
    { zone: "Etc/UTC", expected: "UTC" }
  ])("$zone", ({ expected, zone }) => {
    assert.strictEqual(zoneLabel(zone), expected)
  })
})
