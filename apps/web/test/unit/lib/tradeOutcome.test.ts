import { assert, describe, it } from "@effect/vitest"
import {
  describeTrade,
  describeTrades,
  nothingMoved,
  tradeOutcome,
  tradesOutcome,
  type TradeStage
} from "../../../src/lib/tradeOutcome.ts"

describe("nothingMoved", () => {
  it.each<{ side: "buy" | "sell"; expected: string }>([
    { side: "buy", expected: "Nothing was bought. Your cash is where it was." },
    { side: "sell", expected: "Nothing was sold. Your stocks are where they were." }
  ])("$side", ({ expected, side }) => {
    assert.strictEqual(nothingMoved(side), expected)
  })
})

describe("describeTrade", () => {
  it("a buy, by the cash spent", () => {
    assert.strictEqual(
      describeTrade({ side: "buy", usdc: 50_000_000n, shares: 26_000_000n }, "Apple"),
      "Buy $50.00 of Apple"
    )
  })

  it("a sell, by the shares sold", () => {
    assert.strictEqual(
      describeTrade({ side: "sell", usdc: 40_000_000n, shares: 25_000_000n }, "Nvidia"),
      "Sell 0.25 shares of Nvidia"
    )
  })
})

describe("tradeOutcome", () => {
  it.each<{ stage: TradeStage; side: "buy" | "sell"; described: string; expected: ReturnType<typeof tradeOutcome> }>([
    {
      stage: "sending",
      side: "buy",
      described: "Buy $50 of Apple",
      expected: {
        tone: "pending",
        title: "Buying $50 of Apple",
        description: "Base confirms it in a couple of seconds."
      }
    },
    {
      stage: "confirming",
      side: "sell",
      described: "Sell 1 share of Nvidia",
      expected: {
        tone: "pending",
        title: "Selling 1 share of Nvidia",
        description: "Base confirms it in a couple of seconds."
      }
    },
    {
      stage: "filled",
      side: "buy",
      described: "Buy $50 of Apple",
      expected: { tone: "success", title: "Bought $50 of Apple", description: "It's in your portfolio." }
    },
    {
      stage: "filled",
      side: "sell",
      described: "Sell $20 of Nvidia",
      expected: { tone: "success", title: "Sold $20 of Nvidia", description: "The cash is in your account." }
    },
    {
      stage: "failed",
      side: "buy",
      described: "Buy $50 of Apple",
      expected: {
        tone: "failure",
        title: "Your buy didn't go through",
        description: "Base didn't take it. Nothing was bought. Your cash is where it was."
      }
    },
    {
      stage: "failed",
      side: "sell",
      described: "Sell $20 of Nvidia",
      expected: {
        tone: "failure",
        title: "Your sell didn't go through",
        description: "Base didn't take it. Nothing was sold. Your stocks are where they were."
      }
    }
  ])("$stage $side", ({ described, expected, side, stage }) => {
    assert.deepStrictEqual(tradeOutcome(stage, side, described), expected)
  })
})

describe("describeTrades", () => {
  it.each(
    [
      {
        name: "buys of dollars: their total, then the stocks",
        legs: [
          { side: "buy", usdc: BigInt(2_903_960_000), name: "Microsoft" },
          { side: "buy", usdc: BigInt(1_851_630_000), name: "Amazon" }
        ],
        expected: "Buy $4,755.59 of Microsoft and Amazon"
      },
      {
        name: "sells: the stocks",
        legs: [{ side: "sell", usdc: null, name: "Apple" }, { side: "sell", usdc: null, name: "Tesla" }],
        expected: "Sell Apple and Tesla"
      },
      {
        name: "a sell and a buy: a trade",
        legs: [{ side: "sell", usdc: null, name: "Apple" }, { side: "buy", usdc: BigInt(50_000_000), name: "Nvidia" }],
        expected: "Trade Apple and Nvidia"
      },
      {
        name: "one stock in two steps: named once",
        legs: [
          { side: "buy", usdc: BigInt(10_000_000), name: "Apple" },
          { side: "buy", usdc: BigInt(5_000_000), name: "Apple" }
        ],
        expected: "Buy $15.00 of Apple"
      }
    ] as const
  )("$name", ({ expected, legs }) => {
    assert.strictEqual(describeTrades(legs), expected)
  })
})

describe("tradesOutcome", () => {
  const msft = { side: "buy", usdc: BigInt(2_903_960_000), name: "Microsoft" } as const
  const amzn = { side: "buy", usdc: BigInt(1_851_630_000), name: "Amazon" } as const

  it.each<{ name: string; stages: readonly [TradeStage, TradeStage]; expected: ReturnType<typeof tradesOutcome> }>([
    {
      name: "one still on its way: both on their way",
      stages: ["filled", "confirming"],
      expected: {
        tone: "pending",
        title: "Buying $4,755.59 of Microsoft and Amazon",
        description: "Base confirms them in a couple of seconds."
      }
    },
    {
      name: "both filled",
      stages: ["filled", "filled"],
      expected: {
        tone: "success",
        title: "Bought $4,755.59 of Microsoft and Amazon",
        description: "They're in your portfolio."
      }
    },
    {
      name: "both failed",
      stages: ["failed", "failed"],
      expected: {
        tone: "failure",
        title: "Your trades didn't go through",
        description: "Base didn't take them. Nothing moved."
      }
    },
    {
      name: "one filled, one failed: which",
      stages: ["filled", "failed"],
      expected: {
        tone: "failure",
        title: "Only some went through",
        description: "Bought $2,903.96 of Microsoft. Amazon didn't go through."
      }
    }
  ])("$name", ({ expected, stages }) => {
    assert.deepStrictEqual(
      tradesOutcome([{ stage: stages[0], leg: msft }, { stage: stages[1], leg: amzn }]),
      expected
    )
  })
})
