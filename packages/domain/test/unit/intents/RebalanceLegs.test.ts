import { rebalanceLegs } from "@bluechip/domain/intents/RebalanceLegs"
import { MarketPrice, type StockSymbol } from "@bluechip/domain/market/Market"
import { Bps, Price, Shares, Usdc } from "@bluechip/domain/market/Units"
import { Holding } from "@bluechip/domain/portfolio/Portfolio"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

// $1,000 in all: $600 of Nvidia (4 shares at $150) and $400 of cash.
const nvidia = new Holding({
  symbol: "NVDA",
  shares: Shares.make(400_000_000n),
  price: new MarketPrice({
    symbol: "NVDA",
    price: Price.make(15_000_000_000n),
    tradedAt: DateTime.makeUnsafe("2026-11-26T15:00:00Z"),
    previousClose: null
  }),
  value: Usdc.make(600_000_000n),
  weightBps: Bps.make(6000),
  change24h: null
})
const portfolio = { value: Usdc.make(1_000_000_000n), holdings: [nvidia] }
const prices = new Map<StockSymbol, Price>([["AAPL", Price.make(20_000_000_000n)]])

describe("rebalanceLegs", () => {
  it("on target: no trades", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 6000 }, { asset: "USDC", weight: 4000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [])
  })

  it("a drift just under the trigger: no trades", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 5501 }, { asset: "USDC", weight: 4499 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [])
  })

  it("a drift at the trigger: sells the shares above target", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 5500 }, { asset: "USDC", weight: 4500 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [{ symbol: "NVDA", side: "sell", amount: { shares: Shares.make(33_333_333n) } }])
  })

  it("a stock not held yet: buys with what the sells bring, less 1% they may lose to the price", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 3000 }, { asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 4000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [
      { symbol: "NVDA", side: "sell", amount: { shares: Shares.make(200_000_000n) } },
      { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(297_000_000n) } }
    ])
  })

  it("buys within the cash above its target: each one whole", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 6000 }, { asset: "AAPL", weight: 1000 }, { asset: "USDC", weight: 3000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [{ symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(100_000_000n) } }])
  })

  it("buys over the cash above its target: each scaled down alike, cash ending on its target", () => {
    // $1,000 with $600 of Nvidia, aiming at 20% Nvidia, 30% Apple, 30% Tesla and 40% cash: Apple and Tesla want
    // $300 each, the sell brings $400 (less 1%, $396), and cash may go from $400 + $396 down to its $400 target.
    const legs = rebalanceLegs(portfolio, {
      targets: [
        { asset: "NVDA", weight: 2000 },
        { asset: "AAPL", weight: 2000 },
        { asset: "TSLA", weight: 2000 },
        { asset: "USDC", weight: 4000 }
      ],
      triggerBps: 500
    }, new Map([...prices, ["TSLA", Price.make(40_000_000_000n)]]))

    assert.deepStrictEqual(legs, [
      { symbol: "NVDA", side: "sell", amount: { shares: Shares.make(266_666_666n) } },
      { symbol: "AAPL", side: "buy", amount: { usdc: Usdc.make(198_000_000n) } },
      { symbol: "TSLA", side: "buy", amount: { usdc: Usdc.make(198_000_000n) } }
    ])
  })

  it("cash under its target, the rest in a stock outside the mix: no buys", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "AAPL", weight: 3000 }, { asset: "USDC", weight: 7000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [])
  })

  it("a target of nothing sells every share", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "USDC", weight: 10_000 }, { asset: "NVDA", weight: 0 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [{ symbol: "NVDA", side: "sell", amount: { shares: Shares.make(400_000_000n) } }])
  })

  it("a stock without a price is left alone", () => {
    const legs = rebalanceLegs(portfolio, {
      targets: [{ asset: "NVDA", weight: 6000 }, { asset: "TSLA", weight: 2000 }, { asset: "USDC", weight: 2000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [])
  })

  it("an empty portfolio: no trades", () => {
    const legs = rebalanceLegs({ value: Usdc.make(0n), holdings: [] }, {
      targets: [{ asset: "AAPL", weight: 5000 }, { asset: "USDC", weight: 5000 }],
      triggerBps: 500
    }, prices)

    assert.deepStrictEqual(legs, [])
  })
})
