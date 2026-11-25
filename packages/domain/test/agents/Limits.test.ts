import { rebalanceBand } from "@bluechip/domain/agents/Limits"
import { assert, describe, it } from "@effect/vitest"

describe("rebalanceBand", () => {
  it.each(
    [
      { name: "a 3% trigger: 0.6%", trigger: 300, expected: 60 },
      { name: "a 5% trigger: 1%", trigger: 500, expected: 100 },
      { name: "a 10% trigger: 2%", trigger: 1000, expected: 200 }
    ] as const
  )("$name", ({ expected, trigger }) => {
    assert.strictEqual(rebalanceBand(trigger), expected)
  })
})
