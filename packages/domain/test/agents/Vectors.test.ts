import { evaluate, Rule } from "@bluechip/domain/agents/Evaluate"
import { assert, describe, it } from "@effect/vitest"
import { type Vector, VECTORS } from "./vectors.ts"

describe("shared vectors", () => {
  it("cover every rule", () => {
    const covered = new Set(VECTORS.flatMap((vector) => vector.expected.rules ?? []).map((rule) => rule.split(" ")[0]))

    // Every leg within the collar keeps the portfolio within it too, so `losesValue` only guards the contracts
    // against a batch whose legs trade more than the whole portfolio; Rebalance.test.ts checks it directly.
    const uncovered = Rule.literals.filter((rule) => rule !== "losesValue" && !covered.has(rule))
    assert.deepStrictEqual(uncovered, [])
  })

  for (const vector of VECTORS) {
    it(vector.name, () => {
      const decision = evaluate(vector.proposal)

      const outcome: Vector["expected"] = decision._tag === "Blocked" ?
        {
          decision: decision._tag,
          rules: decision.violations.map(({ rule, symbol }) => (symbol === null ? rule : `${rule} ${symbol}` as const))
        } :
        decision._tag === "Wait" ?
        { decision: decision._tag, wait: decision.reason } :
        { decision: decision._tag }
      assert.deepStrictEqual(outcome, vector.expected)
    })
  }
})
