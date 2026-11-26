import { poolFee, slippage } from "@bluechip/domain/ledger/Costs"
import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

describe("poolFee", () => {
  it.each(
    [
      { name: "a buy in a 0.05% pool", side: "buy", usdc: 100_000_000n, pips: 500, expected: 50_000n },
      {
        name: "a sale in a 0.05% pool: the shares' part at what the rest fetched",
        side: "sell",
        usdc: 99_950_000n,
        pips: 500,
        expected: 50_000n
      },
      { name: "a buy in a 1% pool", side: "buy", usdc: 100_000_000n, pips: 10_000, expected: 1_000_000n },
      { name: "rounds down", side: "buy", usdc: 1_999n, pips: 500, expected: 0n },
      { name: "a pool with no fee", side: "buy", usdc: 100_000_000n, pips: 0, expected: 0n },
      {
        name: "a fee of the whole amount can't be: none",
        side: "sell",
        usdc: 100_000_000n,
        pips: 1_000_000,
        expected: 0n
      },
      { name: "nothing traded", side: "sell", usdc: 0n, pips: 500, expected: 0n }
    ] as const
  )("$name", ({ expected, pips, side, usdc }) => {
    assert.strictEqual<bigint>(poolFee(side, Usdc.make(usdc), pips), expected)
  })
})

describe("slippage", () => {
  it.each(
    [
      {
        name: "a buy that paid more than the shares were worth",
        side: "buy",
        usdc: 100_000_000n,
        shares: 998_000_000n,
        fee: 50_000n,
        expected: 150_000n
      },
      {
        name: "a buy at Chainlink's price exactly, only the fee",
        side: "buy",
        usdc: 100_000_000n,
        shares: 1_000_000_000n,
        fee: 50_000n,
        expected: -50_000n
      },
      {
        name: "a buy better than Chainlink's price",
        side: "buy",
        usdc: 100_000_000n,
        shares: 1_010_000_000n,
        fee: 0n,
        expected: -1_000_000n
      },
      {
        name: "a sale that got less than the shares were worth",
        side: "sell",
        usdc: 99_000_000n,
        shares: 1_000_000_000n,
        fee: 50_000n,
        expected: 950_000n
      },
      {
        name: "a sale better than Chainlink's price",
        side: "sell",
        usdc: 101_000_000n,
        shares: 1_000_000_000n,
        fee: 0n,
        expected: -1_000_000n
      },
      {
        name: "a gap that is only the fee",
        side: "sell",
        usdc: 99_950_000n,
        shares: 1_000_000_000n,
        fee: 50_000n,
        expected: 0n
      }
    ] as const
  )("$name", ({ expected, fee, shares, side, usdc }) => {
    const result = slippage({
      side,
      usdc: Usdc.make(usdc),
      shares: Shares.make(shares),
      reference: Price.make(1_000_000_000n),
      fee: Usdc.make(fee)
    })

    assert.strictEqual(result, expected)
  })
})
