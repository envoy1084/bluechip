import { BlockedBy } from "@bluechip/domain/performance/Performance"
import { assert, describe, it } from "@effect/vitest"
import { blockedSentence } from "../../../../../src/features/agents/model/results.ts"

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
