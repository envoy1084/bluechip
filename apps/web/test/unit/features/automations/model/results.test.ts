import { RunCount } from "@bluechip/domain/performance/Performance"
import { assert, describe, it } from "@effect/vitest"
import { runsSentence } from "../../../../../src/features/automations/model/results.ts"

describe("runsSentence", () => {
  it.each([
    { name: "no runs", runs: 0, outcomes: [], expected: "No runs yet." },
    {
      name: "one run that traded",
      runs: 1,
      outcomes: [new RunCount({ outcome: "proposed", count: 1 })],
      expected: "1 run: 1 traded."
    },
    {
      name: "runs that ended in several ways",
      runs: 4,
      outcomes: [new RunCount({ outcome: "proposed", count: 3 }), new RunCount({ outcome: "skipped", count: 1 })],
      expected: "4 runs: 3 traded, 1 skipped."
    }
  ])("$name", ({ expected, outcomes, runs }) => {
    assert.strictEqual(runsSentence(runs, outcomes), expected)
  })
})
