import { RunCount } from "@bluechip/domain/performance/Performance"
import { assert, describe, it } from "@effect/vitest"
import { outcomesText, runsSentence, timesText } from "../../../../../src/features/automations/model/results.ts"

describe("runsSentence", () => {
  it.each([
    { name: "no runs", runs: 0, outcomes: [], expected: "No runs yet." },
    {
      name: "one run that traded",
      runs: 1,
      outcomes: [new RunCount({ result: "traded", count: 1 })],
      expected: "1 run: 1 traded."
    },
    {
      name: "runs that ended in several ways",
      runs: 4,
      outcomes: [new RunCount({ result: "traded", count: 3 }), new RunCount({ result: "blocked", count: 1 })],
      expected: "4 runs: 3 traded, 1 blocked."
    }
  ])("$name", ({ expected, outcomes, runs }) => {
    assert.strictEqual(runsSentence(runs, outcomes), expected)
  })
})

describe("timesText", () => {
  it.each([
    { name: "never", runs: 0, expected: "Not yet" },
    { name: "once", runs: 1, expected: "Once" },
    { name: "several times", runs: 12, expected: "12 times" }
  ])("$name", ({ expected, runs }) => {
    assert.strictEqual(timesText(runs), expected)
  })
})

describe("outcomesText", () => {
  it("each result with its count, in the order given", () => {
    const text = outcomesText([
      new RunCount({ result: "traded", count: 3 }),
      new RunCount({ result: "failed", count: 2 })
    ])

    assert.strictEqual(text, "3 traded, 2 failed")
  })
})
