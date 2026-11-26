import { assert, describe, it } from "@effect/vitest"
import { describeTrade, nothingMoved, tradeOutcome, type TradeStage } from "../../../src/lib/tradeOutcome.ts"

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
