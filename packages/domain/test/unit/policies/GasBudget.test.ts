import { gasBudget, gasPerDay } from "@bluechip/domain/policies/GasBudget"
import { assert, describe, it } from "@effect/vitest"

describe("gasPerDay", () => {
  it.each<{ name: string; trades: number; expected: bigint }>([
    { name: "no trades: the floor", trades: 0, expected: 5_000_000_000_000_000n },
    { name: "one trade: the floor", trades: 1, expected: 5_000_000_000_000_000n },
    { name: "just over the floor, rounded up to a thousandth", trades: 4, expected: 6_000_000_000_000_000n },
    { name: "a conservative agent's 10", trades: 10, expected: 15_000_000_000_000_000n },
    { name: "a balanced agent's 25, rounded up", trades: 25, expected: 38_000_000_000_000_000n },
    { name: "an active agent's 60", trades: 60, expected: 90_000_000_000_000_000n },
    { name: "a part of a trade counts as a whole", trades: 9.5, expected: 15_000_000_000_000_000n }
  ])("$name", ({ expected, trades }) => {
    assert.strictEqual(gasPerDay(trades), expected)
  })
})

describe("gasBudget", () => {
  it("says the day's gas in ether", () => {
    assert.deepStrictEqual(
      gasBudget.describe({ weiPerDay: 38_000_000_000_000_000n }, { policies: [], name: (symbol) => symbol }),
      { can: ["Spend up to 0.038 ETH on gas a day"], never: [] }
    )
  })

  it.each<{ name: string; after: bigint; expected: string }>([
    { name: "less gas is tighter", after: 1_000_000_000_000_000n, expected: "tighter" },
    { name: "more gas is looser", after: 90_000_000_000_000_000n, expected: "looser" },
    { name: "the same", after: 38_000_000_000_000_000n, expected: "same" }
  ])("$name", ({ after, expected }) => {
    assert.strictEqual(gasBudget.compare({ weiPerDay: 38_000_000_000_000_000n }, { weiPerDay: after }), expected)
  })
})
