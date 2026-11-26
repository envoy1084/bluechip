import type { Facts } from "@bluechip/domain/automations/Condition"
import { holdingAtLeast } from "@bluechip/domain/automations/conditions/HoldingAtLeast"
import { judged } from "@bluechip/domain/automations/conditions/Judgment"
import { all, any, not } from "@bluechip/domain/automations/conditions/Logic"
import { marketOpen } from "@bluechip/domain/automations/conditions/Market"
import { priceAbove, priceBelow } from "@bluechip/domain/automations/conditions/PriceLevel"
import { timeWindow } from "@bluechip/domain/automations/conditions/TimeWindow"
import { Shares } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import { price } from "../../../fixtures/Automations.ts"

// Monday 30 Nov 2026, 10:30 in New York; NVIDIA at $150; 2 shares of NVIDIA held; the market open.
const FACTS: Facts = {
  now: DateTime.makeUnsafe("2026-11-30T15:30:00Z"),
  marketOpen: true,
  pricesFresh: true,
  prices: new Map([["NVDA", price(150)]]),
  holdings: new Map([["NVDA", Shares.make(200_000_000n)]])
}

describe("priceAbove and priceBelow", () => {
  it.each([
    {
      name: "NVIDIA at $150 is above $149",
      result: priceAbove.evaluate!({ symbol: "NVDA", level: price(149) }, FACTS),
      expected: { pass: true, reason: "NVDA is at $150, above $149." }
    },
    {
      name: "NVIDIA at $150 is not above $150",
      result: priceAbove.evaluate!({ symbol: "NVDA", level: price(150) }, FACTS),
      expected: { pass: false, reason: "NVDA is at $150, not above $150." }
    },
    {
      name: "NVIDIA at $150 is below $150.01",
      result: priceBelow.evaluate!({ symbol: "NVDA", level: price(150.01) }, FACTS),
      expected: { pass: true, reason: "NVDA is at $150, below $150.01." }
    },
    {
      name: "a stock without a price",
      result: priceBelow.evaluate!({ symbol: "AAPL", level: price(150) }, FACTS),
      expected: { pass: false, reason: "No price for AAPL." }
    }
  ])("$name", ({ expected, result }) => {
    assert.deepStrictEqual(result, expected)
  })
})

describe("holdingAtLeast", () => {
  it.each([
    {
      name: "any NVIDIA, holding 2 shares",
      shares: 0n,
      symbol: "NVDA" as const,
      expected: { pass: true, reason: "You hold 2 shares of NVDA." }
    },
    {
      name: "at least 2 shares, holding 2",
      shares: 200_000_000n,
      symbol: "NVDA" as const,
      expected: { pass: true, reason: "You hold 2 shares of NVDA." }
    },
    {
      name: "at least 2.5 shares, holding 2",
      shares: 250_000_000n,
      symbol: "NVDA" as const,
      expected: { pass: false, reason: "You hold 2 shares of NVDA." }
    },
    {
      name: "any Apple, holding none",
      shares: 0n,
      symbol: "AAPL" as const,
      expected: { pass: false, reason: "You hold no AAPL." }
    }
  ])("$name", ({ expected, shares, symbol }) => {
    assert.deepStrictEqual(holdingAtLeast.evaluate!({ symbol, shares: Shares.make(shares) }, FACTS), expected)
  })
})

describe("timeWindow", () => {
  it.each([
    {
      name: "10:30 New York is inside 10:00 to 15:00",
      config: { from: "10:00", to: "15:00", days: [], timeZone: "America/New_York" },
      expected: true
    },
    {
      name: "10:30 New York is outside 10:31 to 15:00",
      config: { from: "10:31", to: "15:00", days: [], timeZone: "America/New_York" },
      expected: false
    },
    {
      name: "the end is not included",
      config: { from: "09:00", to: "10:30", days: [], timeZone: "America/New_York" },
      expected: false
    },
    {
      name: "a window past midnight in UTC (15:30 is outside 22:00 to 07:00)",
      config: { from: "22:00", to: "07:00", days: [], timeZone: "UTC" },
      expected: false
    },
    {
      name: "Monday is not one of its Friday-only days",
      config: { from: "00:00", to: "23:59", days: ["friday" as const], timeZone: "America/New_York" },
      expected: false
    }
  ])("$name", ({ config, expected }) => {
    assert.strictEqual(timeWindow.evaluate!(config, FACTS).pass, expected)
  })
})

describe("all, any and not", () => {
  const open = { type: "marketOpen", config: {} } as const
  const cheap = { type: "priceBelow", config: { symbol: "NVDA", level: price(100) } } as const

  it.each([
    {
      name: "all of open and cheap: the first that fails",
      result: all.evaluate!({ conditions: [open, cheap] }, FACTS),
      expected: { pass: false, reason: "NVDA is at $150, not below $100." }
    },
    {
      name: "any of cheap and open: the first that holds",
      result: any.evaluate!({ conditions: [cheap, open] }, FACTS),
      expected: { pass: true, reason: "The market is open." }
    },
    {
      name: "any of cheap alone",
      result: any.evaluate!({ conditions: [cheap] }, FACTS),
      expected: { pass: false, reason: "None of the conditions holds." }
    },
    {
      name: "not cheap",
      result: not.evaluate!({ condition: cheap }, FACTS),
      expected: { pass: true, reason: "NVDA is at $150, not below $100." }
    },
    {
      name: "the market closed",
      result: marketOpen.evaluate!({}, { ...FACTS, marketOpen: false }),
      expected: { pass: false, reason: "The market is closed." }
    }
  ])("$name", ({ expected, result }) => {
    assert.deepStrictEqual(result, expected)
  })
})

describe("judged", () => {
  const config = { preset: "materiallyNegative" as const, minConfidenceBps: 7000 }

  it.each([
    {
      name: "a yes at 0.7",
      answer: { verdict: true, confidence: 0.7, reason: "Guidance cut." },
      expected: { pass: true, reason: "The model said yes (70% sure): Guidance cut." }
    },
    {
      name: "a yes at 0.69",
      answer: { verdict: true, confidence: 0.69, reason: "Guidance cut." },
      expected: { pass: false, reason: "The model said yes, but only 69% sure (it needs 70%)." }
    },
    {
      name: "a no",
      answer: { verdict: false, confidence: 0.9, reason: "A product launch." },
      expected: { pass: false, reason: "The model said no (90% sure): A product launch." }
    }
  ])("$name", ({ answer, expected }) => {
    assert.deepStrictEqual(judged(config, answer), expected)
  })
})
