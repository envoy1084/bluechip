import { Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import { amountHint, type AmountState } from "../../../../../src/features/stocks/model/amountHint.ts"

describe("amountHint", () => {
  it.each<{ name: string; state: AmountState; expected: string | null }>([
    {
      name: "a buy before an amount: the smallest trade",
      state: { _tag: "Empty", side: "buy", symbol: "NVDA", held: BigInt(0) },
      expected: "Enter an amount. The smallest trade is $1."
    },
    {
      name: "a sell of a stock not owned",
      state: { _tag: "Empty", side: "sell", symbol: "NVDA", held: BigInt(0) },
      expected: "You don't own any NVDA yet."
    },
    {
      name: "a sell before an amount, with shares owned",
      state: { _tag: "Empty", side: "sell", symbol: "NVDA", held: BigInt(50_000_000) },
      expected: "Enter how much to sell."
    },
    { name: "a buy under $1", state: { _tag: "BelowMinimum" }, expected: "The smallest trade is $1." },
    {
      name: "a buy over the cash",
      state: { _tag: "OverAvailable", side: "buy" },
      expected: "That's more than your cash."
    },
    {
      name: "a sell over the shares",
      state: { _tag: "OverAvailable", side: "sell" },
      expected: "That's more than you have."
    },
    { name: "a quote on its way", state: { _tag: "Quoting" }, expected: "Getting a price…" },
    {
      name: "a buy quoted",
      state: {
        _tag: "Quoted",
        quote: { side: "buy", usdc: Usdc.make(BigInt(150_000_000)), shares: Shares.make(BigInt(98_000_000)) }
      },
      expected: "About 0.98 shares for $150.00."
    },
    {
      name: "a sell of one share quoted",
      state: {
        _tag: "Quoted",
        quote: { side: "sell", usdc: Usdc.make(BigInt(152_800_000)), shares: Shares.make(BigInt(100_000_000)) }
      },
      expected: "About $152.80 for 1 share."
    },
    { name: "a failed quote: nothing, its alert says why", state: { _tag: "QuoteFailed" }, expected: null }
  ])("$name", ({ expected, state }) => {
    assert.strictEqual(amountHint(state), expected)
  })
})
