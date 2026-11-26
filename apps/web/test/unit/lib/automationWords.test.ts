import { assert, describe, it } from "@effect/vitest"
import { standingOf } from "../../../src/lib/automationWords.ts"

describe("standingOf", () => {
  it.each(
    [
      { name: "active, its last run traded", status: "active", runs: ["proposed", "failed"], expected: "active" },
      { name: "active, its last run failed", status: "active", runs: ["failed", "proposed"], expected: "failing" },
      { name: "active, never run", status: "active", runs: [], expected: "active" },
      { name: "paused, its last run failed", status: "paused", runs: ["failed"], expected: "paused" },
      { name: "done", status: "done", runs: ["proposed"], expected: "ended" },
      { name: "expired", status: "expired", runs: [], expected: "expired" },
      { name: "deleted", status: "deleted", runs: [], expected: "ended" }
    ] as const
  )("$name", ({ expected, runs, status }) => {
    assert.strictEqual(standingOf({ status }, runs.map((outcome) => ({ outcome }))), expected)
  })
})
