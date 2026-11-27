import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, it } from "@effect/vitest"
import { freshEntry, newDraft } from "../../../../../src/features/automations/model/drafts.ts"
import {
  offeredStarters,
  type Recipe,
  type StarterId,
  starterOf,
  starterRecipe,
  type StarterStock
} from "../../../../../src/features/automations/model/starters.ts"

const NVIDIA: StarterStock = { symbol: "NVDA", name: "NVIDIA", price: BigInt(15_204_000_000) }

describe("starterRecipe", () => {
  it.each<{ name: string; id: StarterId; stock: StarterStock; expected: unknown }>(
    [
      {
        name: "a weekly buy: Mondays at 10:00, $50 of the stock",
        id: "weeklyBuy",
        stock: NVIDIA,
        expected: {
          trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
          conditions: [],
          action: { type: "buy", config: { amount: BigInt(50_000_000), split: [{ symbol: "NVDA", weight: 10_000 }] } }
        }
      },
      {
        name: "buy the dip: a 10% fall from its high, then a buy",
        id: "buyTheDip",
        stock: NVIDIA,
        expected: {
          trigger: {
            type: "priceMove",
            config: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" }
          },
          conditions: [],
          action: { type: "buy", config: { amount: BigInt(50_000_000), split: [{ symbol: "NVDA", weight: 10_000 }] } }
        }
      },
      {
        name: "a stop-loss sells all of it after a 10% fall from its high",
        id: "stopLoss",
        stock: NVIDIA,
        expected: {
          trigger: {
            type: "priceMove",
            config: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" }
          },
          conditions: [],
          action: { type: "sellShare", config: { symbol: "NVDA", bps: 10_000 } }
        }
      },
      {
        name: "take profit: a quarter, above 20% over today, in whole dollars",
        id: "takeProfit",
        stock: NVIDIA,
        expected: {
          trigger: {
            type: "priceCross",
            config: { symbol: "NVDA", level: BigInt(18_200_000_000), direction: "above" }
          },
          conditions: [],
          action: { type: "sellShare", config: { symbol: "NVDA", bps: 2500 } }
        }
      },
      {
        name: "take profit on a stock with no price keeps the catalog's level",
        id: "takeProfit",
        stock: { ...NVIDIA, price: null },
        expected: {
          trigger: {
            type: "priceCross",
            config: { symbol: "NVDA", level: BigInt(25_000_000_000), direction: "above" }
          },
          conditions: [],
          action: { type: "sellShare", config: { symbol: "NVDA", bps: 2500 } }
        }
      },
      {
        name: "a price alert 10% under today, saying the stock's name",
        id: "priceAlert",
        stock: NVIDIA,
        expected: {
          trigger: {
            type: "priceCross",
            config: { symbol: "NVDA", level: BigInt(13_700_000_000), direction: "below" }
          },
          conditions: [],
          action: { type: "notify", config: { message: "NVIDIA fell under your price" } }
        }
      },
      {
        name: "a price alert on a stock under $20 is set to the cent",
        id: "priceAlert",
        stock: { symbol: "INTC", name: "Intel", price: BigInt(1_250_000_000) },
        expected: {
          trigger: {
            type: "priceCross",
            config: { symbol: "INTC", level: BigInt(1_125_000_000), direction: "below" }
          },
          conditions: [],
          action: { type: "notify", config: { message: "Intel fell under your price" } }
        }
      },
      {
        name: "a bad news alert asks the model whether the story is bad",
        id: "badNews",
        stock: NVIDIA,
        expected: {
          trigger: { type: "news", config: { symbols: ["NVDA"], topics: [] } },
          conditions: [{ type: "judgment", config: { preset: "materiallyNegative", minConfidenceBps: 7000 } }],
          action: { type: "notify", config: { message: "There's bad news about NVIDIA" } }
        }
      }
    ]
  )("$name", ({ id, stock, expected }) => {
    assert.deepStrictEqual(starterRecipe(id, stock), expected)
  })
})

describe("offeredStarters", () => {
  it("your own trades: every idea", () => {
    assert.deepStrictEqual(
      offeredStarters({ spec: null }).map((starter) => starter.id),
      ["weeklyBuy", "buyTheDip", "stopLoss", "takeProfit", "priceAlert", "badNews"]
    )
  })

  it("an agent that only buys: no ideas that sell", () => {
    const spec = draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })

    assert.deepStrictEqual(
      offeredStarters({ spec }).map((starter) => starter.id),
      ["weeklyBuy", "buyTheDip", "priceAlert", "badNews"]
    )
  })
})

describe("starterOf", () => {
  const stopLoss: Recipe = starterRecipe("stopLoss", NVIDIA)

  it.each<{ name: string; recipe: Recipe; expected: StarterId | null }>(
    [
      {
        name: "a new automation is a weekly buy",
        recipe: newDraft(null, "NVDA", DEFAULT_SETTINGS),
        expected: "weeklyBuy"
      },
      { name: "a fall that sells is a stop-loss", recipe: stopLoss, expected: "stopLoss" },
      {
        name: "a stop-loss with a check added is no idea's",
        recipe: { ...stopLoss, conditions: [freshEntry("condition", "marketOpen", "NVDA") as Recipe["conditions"][0]] },
        expected: null
      },
      {
        name: "a stop-loss that tells you instead is no idea's",
        recipe: { ...stopLoss, action: freshEntry("action", "notify", "NVDA") as Recipe["action"] },
        expected: null
      }
    ]
  )("$name", ({ recipe, expected }) => {
    assert.strictEqual(starterOf(recipe), expected)
  })
})
