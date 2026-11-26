import { formatPrice } from "@bluechip/domain/policies/Format"
import { assert, describe, it } from "@effect/vitest"

describe("formatPrice", () => {
  it.each<{ name: string; price: bigint; expected: string }>([
    { name: "whole dollars", price: 15_000_000_000n, expected: "$150" },
    { name: "cents", price: 15_204_000_000n, expected: "$152.04" },
    { name: "ten cents", price: 18_050_000_000n, expected: "$180.50" },
    { name: "thousands", price: 123_456_000_000n, expected: "$1,234.56" },
    { name: "under a cent, rounded", price: 1n, expected: "$0" }
  ])("$name", ({ expected, price }) => {
    assert.strictEqual(formatPrice(price), expected)
  })
})
