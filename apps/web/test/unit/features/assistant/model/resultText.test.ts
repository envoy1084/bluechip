import { assert, describe, it } from "@effect/vitest"
import { failedText, resetText, waitsForYou } from "../../../../../src/features/assistant/model/resultText.ts"

describe("failedText", () => {
  it.each([
    {
      name: "the problem, after what couldn't be read",
      problem: "Base didn't answer in time.",
      expected: "Couldn't read your portfolio. Base didn't answer in time."
    },
    {
      name: "a problem without a full stop gets one",
      problem: "Prices are paused",
      expected: "Couldn't read your portfolio. Prices are paused."
    },
    { name: "no problem", problem: null, expected: "Couldn't read your portfolio just now. Try again in a moment." },
    {
      name: "a blank problem",
      problem: "  ",
      expected: "Couldn't read your portfolio just now. Try again in a moment."
    }
  ])("$name", ({ expected, problem }) => {
    assert.strictEqual(failedText("getPortfolio", problem), expected)
  })
})

describe("resetText", () => {
  it.each([
    {
      name: "hours and minutes",
      now: "2026-11-27T18:40:00Z",
      expected: "Starts again at 00:00 your time, midnight UTC, in 5 h 20 min"
    },
    {
      name: "whole hours",
      now: "2026-11-27T19:00:00Z",
      expected: "Starts again at 00:00 your time, midnight UTC, in 5 h"
    },
    {
      name: "under an hour",
      now: "2026-11-27T23:15:00Z",
      expected: "Starts again at 00:00 your time, midnight UTC, in 45 min"
    },
    {
      name: "seconds before midnight",
      now: "2026-11-27T23:59:30Z",
      expected: "Starts again at 00:00 your time, midnight UTC, in 1 min"
    },
    {
      name: "just after midnight",
      now: "2026-11-28T00:00:00Z",
      expected: "Starts again at 00:00 your time, midnight UTC, in 24 h"
    }
  ])("$name", ({ expected, now }) => {
    assert.strictEqual(resetText(new Date(now)), expected)
  })
})

describe("waitsForYou", () => {
  it.each(
    [
      { status: "needsApproval", expected: true },
      { status: "awaitingSignature", expected: true },
      { status: "waiting", expected: false },
      { status: "filled", expected: false }
    ] as const
  )("$status", ({ expected, status }) => {
    assert.strictEqual(waitsForYou({ status }), expected)
  })
})
