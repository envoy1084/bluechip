import { evaluate, Rule } from "@bluechip/domain/agents/Evaluate"
import { assert, describe, it } from "@effect/vitest"
import { VECTORS } from "./vectors.ts"

describe("shared vectors", () => {
  it("has a case for every rule", () => {
    const covered = new Set(VECTORS.flatMap((vector) => vector.expected.rules ?? []).map((rule) => rule.split(" ")[0]))
    // Every leg within the collar keeps the portfolio within it too, so `losesValue` only guards the contracts
    // against a batch whose legs trade more than the whole portfolio; Rebalance.test.ts checks it directly.
    for (const rule of Rule.literals.filter((rule) => rule !== "losesValue")) assert.isTrue(covered.has(rule), rule)
    assert.isAtLeast(VECTORS.length, 60)
  })

  for (const vector of VECTORS) {
    it(vector.name, () => {
      const decision = evaluate(vector.proposal)
      assert.strictEqual(decision._tag, vector.expected.decision)

      if (decision._tag === "Blocked") {
        const rules = decision.violations.map(({ rule, symbol }) => (symbol === null ? rule : `${rule} ${symbol}`))
        assert.deepStrictEqual(rules, [...(vector.expected.rules ?? [])] as Array<string>)
      }
      if (decision._tag === "Wait") assert.strictEqual(decision.reason, vector.expected.wait)
    })
  }
})
