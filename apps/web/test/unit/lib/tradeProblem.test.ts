import {
  Conflict,
  InsufficientCash,
  InsufficientShares,
  PriceCheckFailed,
  QuoteUnavailable
} from "@bluechip/domain/Errors"
import { assert, describe, it } from "@effect/vitest"
import { tradeProblem } from "../../../src/lib/tradeProblem.ts"

describe("tradeProblem", () => {
  it("a buy without the cash: what you have", () => {
    assert.strictEqual(
      tradeProblem(new InsufficientCash({ available: 12_500_000n }), "buy"),
      "You have $12.50 in cash."
    )
  })

  it("a sell without the shares: how many you have", () => {
    assert.strictEqual(
      tradeProblem(new InsufficientShares({ symbol: "NVDA", available: 50_000_000n }), "sell"),
      "You have 0.5 shares to sell."
    )
  })

  it("a sell of one share held: singular", () => {
    assert.strictEqual(
      tradeProblem(new InsufficientShares({ symbol: "NVDA", available: 100_000_000n }), "sell"),
      "You have 1 share to sell."
    )
  })

  it("no quote from the pool", () => {
    assert.strictEqual(
      tradeProblem(new QuoteUnavailable({ symbol: "NVDA", reason: "poolError" }), "buy"),
      "We couldn't get a price from the pool. Nothing was bought."
    )
  })

  it("a buy under $1: the smallest trade", () => {
    assert.strictEqual(
      tradeProblem(new QuoteUnavailable({ symbol: "NVDA", reason: "belowMinimum" }), "buy"),
      "The smallest trade is $1. Nothing was bought."
    )
  })

  it("a price too far from Chainlink's", () => {
    assert.strictEqual(
      tradeProblem(new PriceCheckFailed({ symbol: "NVDA", reason: "gap", gapBps: 150, limitBps: 100 }), "sell"),
      "The pool's price is 1.50% off Chainlink's, more than the 1% allowed. Nothing was sold."
    )
  })

  it("Chainlink's price not updating", () => {
    assert.strictEqual(
      tradeProblem(new PriceCheckFailed({ symbol: "NVDA", reason: "stale", gapBps: 0, limitBps: 100 }), "buy"),
      "Chainlink's price isn't updating, so there's nothing to check the trade against. Nothing was bought."
    )
  })

  it("anything else: Face ID cancelled or not sent", () => {
    assert.strictEqual(
      tradeProblem(new Conflict({ reason: "requestIdReused" }), "sell"),
      "Face ID was cancelled or the trade couldn't be sent. Nothing was sold."
    )
  })
})
