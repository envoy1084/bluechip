import { assert, describe, it } from "@effect/vitest"
import { type WorstCase, worstCaseLines, worstCaseOf } from "../../../../../src/features/assistant/model/worstCase.ts"
import { specOf, usd } from "../../../../fixtures/Results.ts"

describe("worstCaseOf", () => {
  it.each<{ name: string; spec: ReturnType<typeof specOf>; expected: WorstCase }>([
    {
      name: "a picker: its budget under what its trades could spend, a fair price and a weekly slippage limit",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA"], direction: "both", dailyBudget: usd(250) } },
        { id: "tradeSize", config: { maxPerTrade: usd(100), minPerTrade: usd(5) } },
        { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: false } },
        { id: "slippageBudget", config: { weeklyBps: 100 } },
        { id: "tradesPerDay", config: { count: 5 } }
      ]),
      expected: {
        daySpend: usd(250),
        trades: 5,
        perTrade: usd(100),
        dayMoved: usd(500),
        dayLoss: usd(5),
        weeklyLossBps: 100
      }
    },
    {
      name: "trades that can't spend its whole budget: their total",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA"], direction: "both", dailyBudget: usd(1000) } },
        { id: "tradeSize", config: { maxPerTrade: usd(100), minPerTrade: usd(5) } },
        { id: "tradesPerDay", config: { count: 3 } }
      ]),
      expected: {
        daySpend: usd(300),
        trades: 3,
        perTrade: usd(100),
        dayMoved: usd(300),
        dayLoss: null,
        weeklyLossBps: null
      }
    },
    {
      name: "an agent that only buys moves its budget at most, even with no count of trades",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA"], direction: "buy", dailyBudget: usd(250) } },
        { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: false } }
      ]),
      expected: {
        daySpend: usd(250),
        trades: null,
        perTrade: null,
        dayMoved: usd(250),
        dayLoss: usd(2.5),
        weeklyLossBps: null
      }
    },
    {
      name: "an agent that only sells spends nothing",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA"], direction: "sell", dailyBudget: usd(0) } },
        { id: "tradeSize", config: { maxPerTrade: usd(100), minPerTrade: usd(5) } },
        { id: "tradesPerDay", config: { count: 5 } }
      ]),
      expected: {
        daySpend: usd(0),
        trades: 5,
        perTrade: usd(100),
        dayMoved: usd(500),
        dayLoss: null,
        weeklyLossBps: null
      }
    },
    {
      name: "buys and sells with no count of trades: what it could move isn't capped",
      spec: specOf([
        { id: "trade", config: { stocks: ["NVDA"], direction: "both", dailyBudget: usd(250) } },
        { id: "fairPrice", config: { collarBps: 100, tradeWhilePaused: false } }
      ]),
      expected: {
        daySpend: usd(250),
        trades: null,
        perTrade: null,
        dayMoved: null,
        dayLoss: null,
        weeklyLossBps: null
      }
    }
  ])("$name", ({ expected, spec }) => {
    assert.deepStrictEqual(worstCaseOf(spec), expected)
  })
})

describe("worstCaseLines", () => {
  it.each<{ name: string; worst: WorstCase; expected: ReadonlyArray<string> }>([
    {
      name: "every limit said",
      worst: {
        daySpend: usd(250),
        trades: 5,
        perTrade: usd(100),
        dayMoved: usd(500),
        dayLoss: usd(5),
        weeklyLossBps: 50
      },
      expected: [
        "On its worst day it could spend $250 in trades of up to $100, $1,750 in a week.",
        "Each trade stays close to Chainlink's price, so prices could cost it at most $5 a day, $35 a week.",
        "It stops once it has lost 0.5% of your money to prices in a week.",
        "It can never send money out of your account."
      ]
    },
    {
      name: "its count of trades spends the whole budget",
      worst: {
        daySpend: usd(200),
        trades: 2,
        perTrade: usd(100),
        dayMoved: usd(200),
        dayLoss: null,
        weeklyLossBps: null
      },
      expected: [
        "On its worst day it could spend $200 in up to 2 trades of $100, $1,400 in a week.",
        "It can never send money out of your account."
      ]
    },
    {
      name: "one trade a day, of any size",
      worst: { daySpend: usd(40), trades: 1, perTrade: null, dayMoved: null, dayLoss: null, weeklyLossBps: null },
      expected: [
        "On its worst day it could spend $40 in one trade, $280 in a week.",
        "It can never send money out of your account."
      ]
    },
    {
      name: "no count of trades",
      worst: { daySpend: usd(250), trades: null, perTrade: null, dayMoved: null, dayLoss: null, weeklyLossBps: null },
      expected: [
        "On its worst day it could spend $250, $1,750 in a week.",
        "It can never send money out of your account."
      ]
    },
    {
      name: "it only sells",
      worst: {
        daySpend: usd(0),
        trades: 5,
        perTrade: usd(100),
        dayMoved: usd(500),
        dayLoss: null,
        weeklyLossBps: null
      },
      expected: [
        "It never spends your cash: it only sells, up to 5 trades of $100 a day.",
        "It can never send money out of your account."
      ]
    },
    {
      name: "it only sells, with no count of trades",
      worst: { daySpend: usd(0), trades: null, perTrade: null, dayMoved: null, dayLoss: null, weeklyLossBps: null },
      expected: ["It never spends your cash: it only sells.", "It can never send money out of your account."]
    },
    {
      name: "cents kept when a loss isn't whole dollars",
      worst: {
        daySpend: usd(250),
        trades: null,
        perTrade: null,
        dayMoved: usd(250),
        dayLoss: usd(2.5),
        weeklyLossBps: null
      },
      expected: [
        "On its worst day it could spend $250, $1,750 in a week.",
        "Each trade stays close to Chainlink's price, so prices could cost it at most $2.50 a day, $17.50 a week.",
        "It can never send money out of your account."
      ]
    }
  ])("$name", ({ expected, worst }) => {
    assert.deepStrictEqual(worstCaseLines(worst), expected)
  })
})
