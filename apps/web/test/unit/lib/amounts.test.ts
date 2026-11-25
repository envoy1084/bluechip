import { assert, describe, it } from "@effect/vitest"
import {
  bpsPercent,
  cleanAmount,
  parseShares,
  parseUsdc,
  priceDollars,
  shareCount,
  usdcDollars
} from "../../../src/lib/amounts.ts"

describe("priceDollars", () => {
  it("a price in 1e8 units as dollars", () => {
    assert.strictEqual(priceDollars(15_204_000_000n), 152.04)
  })
})

describe("shareCount", () => {
  it("shares in 1e8 units as a count", () => {
    assert.strictEqual(shareCount(12_500_000n), 0.125)
  })
})

describe("usdcDollars", () => {
  it("USDC base units as dollars", () => {
    assert.strictEqual(usdcDollars(1_234_560_000n), 1234.56)
  })
})

describe("bpsPercent", () => {
  it("basis points as a percent", () => {
    assert.strictEqual(bpsPercent(30), 0.3)
  })
})

describe("parseUsdc", () => {
  it.each<{ name: string; text: string; expected: bigint | null }>([
    { name: "whole dollars", text: "12", expected: 12_000_000n },
    { name: "cents", text: "12.5", expected: 12_500_000n },
    { name: "thousands commas and spaces", text: "1, 000", expected: 1_000_000_000n },
    { name: "a leading dot", text: ".5", expected: 500_000n },
    { name: "a trailing dot", text: "3.", expected: 3_000_000n },
    { name: "places past USDC's six are cut", text: "0.0000019", expected: 1n },
    { name: "empty", text: "", expected: null },
    { name: "a lone dot", text: ".", expected: null },
    { name: "zero", text: "0.00", expected: null },
    { name: "a dust amount cut to zero", text: "0.0000001", expected: null },
    { name: "letters", text: "12a", expected: null },
    { name: "two dots", text: "1.2.3", expected: null },
    { name: "a negative amount", text: "-5", expected: null }
  ])("$name", ({ expected, text }) => {
    assert.strictEqual(parseUsdc(text), expected)
  })
})

describe("parseShares", () => {
  it.each<{ name: string; text: string; expected: bigint | null }>([
    { name: "a fraction of a share", text: "0.125", expected: 12_500_000n },
    { name: "eight places kept", text: "0.00000001", expected: 1n },
    { name: "the ninth place cut", text: "0.000000019", expected: 1n },
    { name: "zero", text: "0", expected: null }
  ])("$name", ({ expected, text }) => {
    assert.strictEqual(parseShares(text), expected)
  })
})

describe("cleanAmount", () => {
  it.each<{ name: string; text: string; decimals: number; expected: string }>([
    { name: "digits as typed", text: "125", decimals: 2, expected: "125" },
    { name: "anything but digits and dots dropped", text: "$1,2a5", decimals: 2, expected: "125" },
    { name: "places past the limit dropped", text: "1.2345", decimals: 2, expected: "1.23" },
    { name: "a second dot folded into the fraction", text: "1.2.3", decimals: 2, expected: "1.23" },
    { name: "a trailing dot kept while typing", text: "1.", decimals: 2, expected: "1." },
    { name: "empty", text: "", decimals: 2, expected: "" }
  ])("$name", ({ decimals, expected, text }) => {
    assert.strictEqual(cleanAmount(text, decimals), expected)
  })
})
