import { bpsBetween, lessBps, Price, priceOf, Shares, sharesFor, Usdc, valueOf } from "@bluechip/domain/market/Units"
import { assert, describe, it } from "@effect/vitest"

describe("valueOf", () => {
  it.each([
    { name: "one share-token at $1 is 1 USDC", shares: 100_000_000n, price: 100_000_000n, expected: 1_000_000n },
    // 0.65626105 NVDA × $152.03644218 = $99.7755959…
    { name: "a fraction of a cent rounds down", shares: 65_626_105n, price: 15_203_644_218n, expected: 99_775_595n },
    { name: "a value under one unit is zero", shares: 1n, price: 100_000_000n, expected: 0n },
    { name: "no shares are worth nothing", shares: 0n, price: 15_203_644_218n, expected: 0n },
    { name: "any shares at a zero price are worth nothing", shares: 100_000_000n, price: 0n, expected: 0n }
  ])("$name", ({ expected, price, shares }) => {
    assert.strictEqual(valueOf(Shares.make(shares), Price.make(price)), expected)
  })
})

describe("sharesFor", () => {
  it.each([
    { name: "1 USDC at $1 buys one share-token", usdc: 1_000_000n, price: 100_000_000n, expected: 100_000_000n },
    // $100 ÷ $152.03644218 = 0.657737048… NVDA
    { name: "a fraction of a unit rounds down", usdc: 100_000_000n, price: 15_203_644_218n, expected: 65_773_704n },
    { name: "no USDC buys nothing", usdc: 0n, price: 15_203_644_218n, expected: 0n },
    { name: "a zero price buys nothing", usdc: 1n, price: 0n, expected: 0n }
  ])("$name", ({ expected, price, usdc }) => {
    assert.strictEqual(sharesFor(Usdc.make(usdc), Price.make(price)), expected)
  })

  it.prop(
    "buying then valuing never returns more than was spent",
    { usdc: Usdc, price: Price },
    ({ price, usdc }) => valueOf(sharesFor(usdc, price), price) <= usdc
  )
})

describe("priceOf", () => {
  it.each([
    // 100 USDC for 0.65626105 NVDA is $152.3783866…
    { name: "a trade's price per share", usdc: 100_000_000n, shares: 65_626_105n, expected: 15_237_838_662n },
    // $2 for 3 share-tokens: $0.6666666666…7, rounded up.
    { name: "a remainder over half rounds up", usdc: 2n, shares: 3n, expected: 6_666_666_667n },
    // $1 for 3 share-tokens: $0.3333333333…3, rounded down.
    { name: "a remainder under half rounds down", usdc: 1n, shares: 3n, expected: 3_333_333_333n },
    { name: "no shares is a zero price", usdc: 100_000_000n, shares: 0n, expected: 0n }
  ])("$name", ({ expected, shares, usdc }) => {
    assert.strictEqual(priceOf(Usdc.make(usdc), Shares.make(shares)), expected)
  })
})

describe("bpsBetween", () => {
  it.each([
    {
      name: "a value above its reference is positive",
      value: 15_237_838_662n,
      reference: 15_203_644_218n,
      expected: 22
    },
    { name: "a value below its reference is negative", value: 99n, reference: 100n, expected: -100 },
    { name: "an equal value is zero", value: 100n, reference: 100n, expected: 0 },
    { name: "a positive gap under 1 bp rounds to zero", value: 100_001n, reference: 100_000n, expected: 0 },
    { name: "a negative gap under 1 bp rounds to zero", value: 99_999n, reference: 100_000n, expected: 0 },
    { name: "a zero reference is zero", value: 100n, reference: 0n, expected: 0 }
  ])("$name", ({ expected, reference, value }) => {
    assert.strictEqual(bpsBetween(value, reference), expected)
  })
})

describe("lessBps", () => {
  it.each([
    { name: "50 bps off 1 USDC", amount: 1_000_000n, bps: 50, expected: 995_000n },
    // 999 × 0.995 = 994.005
    { name: "a fraction of a unit rounds down", amount: 999n, bps: 50, expected: 994n },
    { name: "zero bps leaves the amount", amount: 1_000_000n, bps: 0, expected: 1_000_000n },
    { name: "10,000 bps leaves nothing", amount: 1_000_000n, bps: 10_000, expected: 0n }
  ])("$name", ({ amount, bps, expected }) => {
    assert.strictEqual(lessBps(amount, bps), expected)
  })
})
