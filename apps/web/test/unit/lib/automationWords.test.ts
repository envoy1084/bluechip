import { assert, describe, it } from "@effect/vitest"
import { runResultText, standingOf } from "../../../src/lib/automationWords.ts"

describe("standingOf", () => {
  it.each(
    [
      {
        name: "active, its last run proposed trades",
        status: "active",
        runs: ["proposed", "failed"],
        expected: "active"
      },
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

describe("runResultText", () => {
  it.each(
    [
      {
        name: "blocked by one policy",
        result: "blocked",
        blockedBy: ["tradeSize"],
        expected: "Its trades were blocked by Trade size, so nothing was traded."
      },
      {
        name: "blocked by two policies",
        result: "blocked",
        blockedBy: ["tradeSize", "cashReserve"],
        expected: "Its trades were blocked by Trade size and Cash reserve, so nothing was traded."
      },
      {
        name: "partly traded, the rest blocked",
        result: "partlyTraded",
        blockedBy: ["tradeSize"],
        expected: "Some of its trades filled; the others didn't go through, blocked by Trade size."
      },
      {
        name: "partly traded, the rest failed onchain",
        result: "partlyTraded",
        blockedBy: [],
        expected: "Some of its trades filled; the others didn't go through."
      },
      { name: "traded", result: "traded", blockedBy: [], expected: null }
    ] as const
  )("$name", ({ blockedBy, expected, result }) => {
    assert.strictEqual(runResultText({ result, blockedBy }), expected)
  })
})
