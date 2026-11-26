import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { type DecisionFacts, decisionFacts } from "../../../../../src/features/assistant/model/decisionText.ts"

describe("decisionFacts", () => {
  it.each<{ name: string; decision: Parameters<typeof decisionFacts>[0]; expected: DecisionFacts }>([
    {
      name: "passed: nothing decided against it",
      decision: { _tag: "Passes", callGasLimit: BigInt(400_000) },
      expected: { policy: null, limit: null, wouldPass: null }
    },
    {
      name: "over its largest trade",
      decision: { _tag: "OverLargestTrade", maxPerTrade: Usdc.make(BigInt(100_000_000)) },
      expected: {
        policy: "Trade size",
        limit: "Its largest trade on its own is $100.",
        wouldPass: "A trade of $100 or less goes without asking you."
      }
    },
    {
      name: "it asks every time",
      decision: { _tag: "Ask" },
      expected: { policy: null, limit: "It asks you before every trade.", wouldPass: null }
    },
    {
      name: "refused by its stock cap",
      decision: {
        _tag: "Refused",
        policy: "stockCap",
        error: "StockCapExceeded",
        stock: "NVDA",
        message: "Nvidia would be 34% of your portfolio, over its cap of 30%."
      },
      expected: {
        policy: "Max in one stock",
        limit: "Nvidia would be 34% of your portfolio, over its cap of 30%.",
        wouldPass: "A smaller buy, keeping the stock under its share of your money."
      }
    },
    {
      name: "refused by a policy with nothing that would pass",
      decision: { _tag: "Refused", policy: "anyCall", error: null, stock: null, message: "Not allowed." },
      expected: { policy: "Calls", limit: "Not allowed.", wouldPass: null }
    },
    {
      name: "waiting",
      decision: { _tag: "Wait", reason: "pricesPaused", until: DateTime.makeUnsafe("2026-11-27T14:30:00Z") },
      expected: { policy: null, limit: null, wouldPass: "The same trade, once the wait is over. Nothing to do." }
    }
  ])("$name", ({ decision, expected }) => {
    assert.deepStrictEqual(decisionFacts(decision), expected)
  })
})
