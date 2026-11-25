import { assert, describe, it } from "@effect/vitest"
import { liquidityFor, rangeAround, sqrt, sqrtPriceX96Of, tickOf } from "../devnet/pools.ts"

const Q96 = BigInt(2) ** BigInt(96)

describe("sqrt", () => {
  it("a perfect square", () => {
    assert.strictEqual(sqrt(BigInt(144)), BigInt(12))
  })

  it("rounds down between squares", () => {
    assert.strictEqual(sqrt(BigInt(143)), BigInt(11))
  })

  it("zero and one", () => {
    assert.strictEqual(sqrt(BigInt(0)), BigInt(0))
    assert.strictEqual(sqrt(BigInt(1)), BigInt(1))
  })
})

describe("sqrtPriceX96Of", () => {
  it("a $100 stock trades one stock unit per USDC unit", () => {
    assert.strictEqual(sqrtPriceX96Of(BigInt(10_000_000_000)), Q96)
  })

  it("a $400 stock trades half a unit's root", () => {
    assert.strictEqual(sqrtPriceX96Of(BigInt(40_000_000_000)), Q96 / BigInt(2))
  })
})

describe("tickOf", () => {
  it("price one is tick zero", () => {
    assert.strictEqual(tickOf(Q96), 0)
  })

  it("a $400 stock is below tick zero", () => {
    // log(0.25) / log(1.0001) = -13863.6…
    assert.strictEqual(tickOf(Q96 / BigInt(2)), -13864)
  })
})

describe("rangeAround", () => {
  it("widens to the tick spacing on both sides", () => {
    assert.deepStrictEqual(rangeAround(-13864, 4000, 10), { lower: -17870, upper: -9860 })
  })
})

describe("liquidityFor", () => {
  it("one USDC unit at price one, up to a quarter more in price", () => {
    // 1.0001^2232 ≈ 1.25007 and √ ≈ 1.11806, so L ≈ 10^6 × 1.11806 / 0.11806 ≈ 9.470 million; sized in floating
    // point, so within 0.01%.
    const liquidity = liquidityFor(BigInt(1_000_000), Q96, 2232)
    assert.isTrue(liquidity > BigInt(9_469_000) && liquidity < BigInt(9_471_000), String(liquidity))
  })
})
