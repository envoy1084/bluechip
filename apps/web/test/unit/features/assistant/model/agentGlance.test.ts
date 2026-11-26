import { assert, describe, it } from "@effect/vitest"
import { type AgentGlance, agentGlance } from "../../../../../src/features/assistant/model/agentGlance.ts"
import { specOf, usd } from "../../../../fixtures/Results.ts"

describe("agentGlance", () => {
  it.each<{ name: string; spec: ReturnType<typeof specOf>; expected: AgentGlance }>([
    {
      name: "its stocks, its way and its three numbers",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA", "AAPL"], direction: "both", dailyBudget: usd(250) } },
        { id: "tradeSize", config: { maxPerTrade: usd(100), minPerTrade: usd(5) } },
        { id: "tradesPerDay", config: { count: 5 } }
      ]),
      expected: {
        stocks: ["NVDA", "AAPL"],
        direction: "Buys and sells",
        stats: [
          { label: "A day", value: "$250" },
          { label: "Per trade", value: "$100" },
          { label: "Trades a day", value: "5" }
        ]
      }
    },
    {
      name: "a template's count of trades, which is no limit of its own",
      spec: specOf([
        { id: "trade", config: { stocks: ["TSLA"], direction: "both", dailyBudget: usd(100) } },
        { id: "tradeSize", config: { maxPerTrade: usd(50), minPerTrade: usd(5) } },
        { id: "tradesPerDay", config: { count: 500 } }
      ]),
      expected: {
        stocks: ["TSLA"],
        direction: "Buys and sells",
        stats: [
          { label: "A day", value: "$100" },
          { label: "Per trade", value: "$50" },
          { label: "Trades a day", value: "No limit" }
        ]
      }
    },
    {
      name: "a seller spends nothing a day, and nothing caps its trades",
      spec: specOf([{ id: "trade", config: { stocks: ["TSLA"], direction: "sell", dailyBudget: usd(0) } }]),
      expected: {
        stocks: ["TSLA"],
        direction: "Only sells",
        stats: [
          { label: "A day", value: "None" },
          { label: "Per trade", value: "Any" },
          { label: "Trades a day", value: "Any" }
        ]
      }
    },
    {
      name: "cents kept on a budget that isn't whole dollars",
      spec: specOf([{ id: "trade", config: { stocks: [], direction: "rebalance", dailyBudget: usd(12.5) } }]),
      expected: {
        stocks: [],
        direction: "Trades back to your mix",
        stats: [
          { label: "A day", value: "$12.50" },
          { label: "Per trade", value: "Any" },
          { label: "Trades a day", value: "Any" }
        ]
      }
    },
    {
      name: "no trade policy",
      spec: specOf([]),
      expected: {
        stocks: [],
        direction: null,
        stats: [
          { label: "A day", value: "None" },
          { label: "Per trade", value: "Any" },
          { label: "Trades a day", value: "Any" }
        ]
      }
    }
  ])("$name", ({ expected, spec }) => {
    assert.deepStrictEqual(agentGlance(spec), expected)
  })
})
