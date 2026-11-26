import { BlockedBy, Costs } from "@bluechip/domain/performance/Performance"
import { assert, describe, it } from "@effect/vitest"
import { blockedSentence, costShare } from "../../../../../src/features/agents/model/results.ts"

describe("blockedSentence", () => {
  it.each(
    [
      { name: "nothing tried", decided: 0, blocked: 0, blockedBy: [], expected: "It hasn't tried a trade yet." },
      {
        name: "nothing blocked",
        decided: 1,
        blocked: 0,
        blockedBy: [],
        expected: "Its policies haven't blocked any of the 1 trade it tried."
      },
      {
        name: "one policy, once",
        decided: 5,
        blocked: 1,
        blockedBy: [new BlockedBy({ policy: "stockCap", count: 1 })],
        expected: "Its policies blocked 1 of the 5 trades it tried: Max in one stock once."
      },
      {
        name: "two policies, twice and three times",
        decided: 9,
        blocked: 5,
        blockedBy: [
          new BlockedBy({ policy: "stockCap", count: 3 }),
          new BlockedBy({ policy: "tradesPerDay", count: 2 })
        ],
        expected: "Its policies blocked 5 of the 9 trades it tried: Max in one stock 3 times, Trades a day twice."
      }
    ] as const
  )("$name", ({ expected, ...performance }) => {
    const titles: Record<string, string> = { stockCap: "Max in one stock", tradesPerDay: "Trades a day" }

    assert.strictEqual(blockedSentence(performance, (policy) => titles[policy] ?? policy), expected)
  })
})

describe("costShare", () => {
  it.each<{ name: string; fees: bigint; slippage: bigint; bought: bigint; sold: bigint; expected: unknown }>([
    { name: "nothing moved", fees: 0n, slippage: 0n, bought: 0n, sold: 0n, expected: { dollars: 0n, percent: null } },
    {
      name: "a $100 buy costing 9 cents",
      fees: 50_000n,
      slippage: 40_000n,
      bought: 100_000_000n,
      sold: 0n,
      expected: { dollars: 90_000n, percent: 0.09 }
    },
    {
      name: "slippage that beat Chainlink takes some back",
      fees: 100_000n,
      slippage: -40_000n,
      bought: 50_000_000n,
      sold: 50_000_000n,
      expected: { dollars: 60_000n, percent: 0.06 }
    }
  ])("$name", ({ bought, expected, fees, slippage, sold }) => {
    assert.deepStrictEqual(
      costShare({ costs: new Costs({ fees, slippage, gasWei: 0n }), bought, sold }),
      expected
    )
  })
})
