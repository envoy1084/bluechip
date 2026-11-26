import type { Automation } from "@bluechip/domain/automations/Automation"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { type SentencePart, sentenceParts, stocksIn } from "../../../../../src/features/automations/model/sentence.ts"

describe("stocksIn", () => {
  it.each<{ name: string; automation: Pick<Automation, "trigger" | "conditions" | "action">; expected: Array<string> }>(
    [
      {
        name: "a schedule buying a split names each stock of the split",
        automation: {
          trigger: { type: "schedule", config: { days: ["monday"], time: "10:00", timeZone: "America/New_York" } },
          conditions: [],
          action: {
            type: "buy",
            config: {
              amount: Usdc.make(50_000_000n),
              split: [{ symbol: "NVDA", weight: 5000 }, { symbol: "AAPL", weight: 5000 }]
            }
          }
        },
        expected: ["NVDA", "AAPL"]
      },
      {
        name: "a stock named by the trigger, a condition and the action counts once",
        automation: {
          trigger: {
            type: "priceMove",
            config: { symbol: "NVDA", reference: "trailingHigh", bps: 1000, direction: "down" }
          },
          conditions: [{ type: "holdingAtLeast", config: { symbol: "NVDA", shares: Shares.make(0n) } }],
          action: { type: "sellShare", config: { symbol: "NVDA", bps: 5000 } }
        },
        expected: ["NVDA"]
      },
      {
        name: "news on several stocks, then a sell of another",
        automation: {
          trigger: { type: "news", config: { symbols: ["TSLA", "META"], topics: ["chips"] } },
          conditions: [],
          action: { type: "sellShare", config: { symbol: "AAPL", bps: 2500 } }
        },
        expected: ["TSLA", "META", "AAPL"]
      },
      {
        name: "a rebalance on drift names none",
        automation: {
          trigger: { type: "drift", config: {} },
          conditions: [],
          action: { type: "rebalance", config: {} }
        },
        expected: []
      },
      {
        name: "a price cross with a notice",
        automation: {
          trigger: {
            type: "priceCross",
            config: { symbol: "AMZN", level: Price.make(20_000_000_000n), direction: "below" }
          },
          conditions: [],
          action: { type: "notify", config: { message: "Amazon is under $200" } }
        },
        expected: ["AMZN"]
      }
    ]
  )("$name", ({ automation, expected }) => {
    assert.deepStrictEqual(stocksIn(automation), expected)
  })
})

describe("sentenceParts", () => {
  const stocks = [
    { symbol: "AAPL", name: "Apple" },
    { symbol: "NVDA", name: "NVIDIA" }
  ] as const

  it.each<{ name: string; sentence: string; expected: Array<SentencePart> }>([
    {
      name: "a weekly buy: the amount, then the stock by name",
      sentence: "Every Monday at 10:00 New York time, buy $50 of Apple.",
      expected: [
        { kind: "text", text: "Every Monday at 10:00 New York time, buy " },
        { kind: "amount", text: "$50" },
        { kind: "text", text: " of " },
        { kind: "stock", text: "Apple", symbol: "AAPL" },
        { kind: "text", text: "." }
      ]
    },
    {
      name: "a percentage and the same stock twice",
      sentence: "When NVIDIA falls 10% from its high, sell half your NVIDIA.",
      expected: [
        { kind: "text", text: "When " },
        { kind: "stock", text: "NVIDIA", symbol: "NVDA" },
        { kind: "text", text: " falls " },
        { kind: "amount", text: "10%" },
        { kind: "text", text: " from its high, sell half your " },
        { kind: "stock", text: "NVIDIA", symbol: "NVDA" },
        { kind: "text", text: "." }
      ]
    },
    {
      name: "a stock named by its symbol, and dollars with cents and thousands",
      sentence: "When AAPL goes above $1,250.50, buy $12.50 of AAPL.",
      expected: [
        { kind: "text", text: "When " },
        { kind: "stock", text: "AAPL", symbol: "AAPL" },
        { kind: "text", text: " goes above " },
        { kind: "amount", text: "$1,250.50" },
        { kind: "text", text: ", buy " },
        { kind: "amount", text: "$12.50" },
        { kind: "text", text: " of " },
        { kind: "stock", text: "AAPL", symbol: "AAPL" },
        { kind: "text", text: "." }
      ]
    },
    {
      name: "a name inside another word is not the stock",
      sentence: "AppleCare renews, buy Apple.",
      expected: [
        { kind: "text", text: "AppleCare renews, buy " },
        { kind: "stock", text: "Apple", symbol: "AAPL" },
        { kind: "text", text: "." }
      ]
    },
    {
      name: "a sentence with nothing to pick out",
      sentence: "When your mix drifts past the agent's trigger, trade back to your target mix.",
      expected: [{
        kind: "text",
        text: "When your mix drifts past the agent's trigger, trade back to your target mix."
      }]
    }
  ])("$name", ({ expected, sentence }) => {
    assert.deepStrictEqual(sentenceParts(sentence, stocks), expected)
  })

  it("with no stocks, it still picks out amounts", () => {
    assert.deepStrictEqual(sentenceParts("Buy $50 of Apple.", []), [
      { kind: "text", text: "Buy " },
      { kind: "amount", text: "$50" },
      { kind: "text", text: " of Apple." }
    ])
  })
})
