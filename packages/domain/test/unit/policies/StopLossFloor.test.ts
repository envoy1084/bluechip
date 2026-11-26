import { Price, Usdc } from "@bluechip/domain/market/Units"
import type { PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { checkSpec, describeSpec } from "@bluechip/domain/policies/Catalog"
import type { Change } from "@bluechip/domain/policies/Policy"
import { stopLossFloor, type StopLossFloorConfig } from "@bluechip/domain/policies/StopLossFloor"
import { assert, describe, it } from "@effect/vitest"
import { changed, GUARD, REBALANCER } from "../../fixtures/Specs.ts"

describe("stopLossFloor.validate", () => {
  it.each<{ name: string; spec: typeof GUARD; expected: ReadonlyArray<readonly [PolicyId, string | null, string]> }>([
    { name: "a Stop-loss guard with a floor for each stock", spec: GUARD, expected: [] },
    {
      name: "an agent that trades both ways",
      spec: changed(GUARD, { id: "trade", config: { direction: "both", dailyBudget: Usdc.make(250_000_000n) } }),
      expected: []
    },
    {
      name: "an agent that only buys",
      spec: changed(GUARD, { id: "trade", config: { direction: "buy", dailyBudget: Usdc.make(250_000_000n) } }),
      expected: [["stopLossFloor", null, "Only an agent that sells has a stop-loss floor."]]
    },
    {
      name: "a Rebalancer",
      spec: changed(REBALANCER, {
        id: "stopLossFloor",
        config: {
          floors: [{ symbol: "NVDA", price: Price.make(15_000_000_000n) }, {
            symbol: "AAPL",
            price: Price.make(18_000_000_000n)
          }]
        }
      }),
      expected: [["stopLossFloor", null, "Only an agent that sells has a stop-loss floor."]]
    },
    {
      name: "no floors",
      spec: changed(GUARD, { id: "stopLossFloor", config: { floors: [] } }),
      expected: [["stopLossFloor", "floors", "Give every stock a floor."]]
    },
    {
      name: "a stock without a floor",
      spec: changed(GUARD, {
        id: "stopLossFloor",
        config: { floors: [{ symbol: "NVDA", price: Price.make(15_000_000_000n) }] }
      }),
      expected: [["stopLossFloor", "floors", "Give every stock a floor."]]
    },
    {
      name: "a stock with two floors",
      spec: changed(GUARD, {
        id: "stopLossFloor",
        config: {
          floors: [
            { symbol: "NVDA", price: Price.make(15_000_000_000n) },
            { symbol: "NVDA", price: Price.make(14_000_000_000n) },
            { symbol: "AAPL", price: Price.make(18_000_000_000n) }
          ]
        }
      }),
      expected: [["stopLossFloor", "floors", "Each stock can have one floor."]]
    },
    {
      name: "a floor for a stock it doesn't trade",
      spec: changed(GUARD, {
        id: "stopLossFloor",
        config: {
          floors: [
            { symbol: "NVDA", price: Price.make(15_000_000_000n) },
            { symbol: "AAPL", price: Price.make(18_000_000_000n) },
            { symbol: "TSLA", price: Price.make(30_000_000_000n) }
          ]
        }
      }),
      expected: [["stopLossFloor", "floors", "Floors can only be set for the stocks it trades."]]
    },
    {
      name: "a floor of $0",
      spec: changed(GUARD, {
        id: "stopLossFloor",
        config: {
          floors: [{ symbol: "NVDA", price: Price.make(0n) }, { symbol: "AAPL", price: Price.make(18_000_000_000n) }]
        }
      }),
      expected: [["stopLossFloor", "floors", "A floor has to be more than $0."]]
    },
    {
      name: "a floor of the smallest price above $0",
      spec: changed(GUARD, {
        id: "stopLossFloor",
        config: {
          floors: [{ symbol: "NVDA", price: Price.make(1n) }, { symbol: "AAPL", price: Price.make(18_000_000_000n) }]
        }
      }),
      expected: []
    }
  ])("$name", ({ expected, spec }) => {
    const problems = checkSpec(spec).map(({ field, message, policy }) => [policy, field, message] as const)

    assert.deepStrictEqual(problems, expected)
  })
})

describe("stopLossFloor.describe", () => {
  const NAMES: Record<string, string> = { NVDA: "Nvidia", AAPL: "Apple" }

  it("a Stop-loss guard of Nvidia and Apple", () => {
    const description = describeSpec(GUARD, (symbol) => NAMES[symbol] ?? symbol)

    assert.deepStrictEqual(description.never.slice(2, -2), [
      "Make a trade under $5",
      "Trade more than 1% away from Chainlink's price",
      "Sell Nvidia above $150",
      "Sell Apple above $180"
    ])
  })

  it("a floor with cents", () => {
    const description = stopLossFloor.describe(
      { floors: [{ symbol: "NVDA", price: Price.make(15_204_000_000n) }] },
      { policies: [], name: (symbol) => NAMES[symbol] ?? symbol }
    )

    assert.deepStrictEqual(description, { can: [], never: ["Sell Nvidia above $152.04"] })
  })

  it("no floors", () => {
    const description = stopLossFloor.describe({ floors: [] }, { policies: [], name: (symbol) => symbol })

    assert.deepStrictEqual(description, { can: [], never: ["Sell a stock you haven't set a floor for"] })
  })
})

describe("stopLossFloor.compare", () => {
  const BEFORE: StopLossFloorConfig = {
    floors: [{ symbol: "NVDA", price: Price.make(15_000_000_000n) }, {
      symbol: "AAPL",
      price: Price.make(18_000_000_000n)
    }]
  }

  it.each<{ name: string; after: StopLossFloorConfig; expected: Change }>([
    { name: "the same floors", after: BEFORE, expected: "same" },
    {
      name: "the same floors in another order",
      after: { floors: [BEFORE.floors[1]!, BEFORE.floors[0]!] },
      expected: "same"
    },
    {
      name: "a floor a unit lower",
      after: { floors: [{ symbol: "NVDA", price: Price.make(14_999_999_999n) }, BEFORE.floors[1]!] },
      expected: "tighter"
    },
    {
      name: "a floor a unit higher",
      after: { floors: [{ symbol: "NVDA", price: Price.make(15_000_000_001n) }, BEFORE.floors[1]!] },
      expected: "looser"
    },
    { name: "a floor removed", after: { floors: [BEFORE.floors[0]!] }, expected: "tighter" },
    {
      name: "a floor added",
      after: { floors: [...BEFORE.floors, { symbol: "TSLA", price: Price.make(20_000_000_000n) }] },
      expected: "looser"
    },
    {
      name: "one floor lowered and another raised",
      after: {
        floors: [{ symbol: "NVDA", price: Price.make(14_000_000_000n) }, {
          symbol: "AAPL",
          price: Price.make(19_000_000_000n)
        }]
      },
      expected: "looser"
    }
  ])("$name", ({ after, expected }) => {
    assert.strictEqual(stopLossFloor.compare(BEFORE, after), expected)
  })
})
