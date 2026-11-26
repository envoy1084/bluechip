import { reconcile } from "@bluechip/domain/ledger/Reconcile"
import { assert, describe, it } from "@effect/vitest"

describe("reconcile", () => {
  it("balances as expected: nothing to record", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 100n], ["NVDA", 5n]]),
      onchain: new Map([["USDC", 100n], ["NVDA", 5n]]),
      deposits: []
    })

    assert.deepStrictEqual(result, { deposits: [], adjustments: [] })
  })

  it("cash that arrived in a transfer: a deposit, nothing unexplained", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 100n]]),
      onchain: new Map([["USDC", 600n]]),
      deposits: [{ amount: 500n, txHash: "0x01" }]
    })

    assert.deepStrictEqual(result, { deposits: [{ amount: 500n, txHash: "0x01" }], adjustments: [] })
  })

  it("two deposits that add up to the difference", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 0n]]),
      onchain: new Map([["USDC", 300n]]),
      deposits: [100n, 200n]
    })

    assert.deepStrictEqual(result, { deposits: [100n, 200n], adjustments: [] })
  })

  it("more cash than deposits explain: the rest is unexplained", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 0n]]),
      onchain: new Map([["USDC", 700n]]),
      deposits: [500n]
    })

    assert.deepStrictEqual(result.adjustments, [{ asset: "USDC", amount: 200n, reason: "unexplained" }])
  })

  it("cash gone with no withdrawal: unexplained, negative", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 1_000n]]),
      onchain: new Map([["USDC", 400n]]),
      deposits: []
    })

    assert.deepStrictEqual(result.adjustments, [{ asset: "USDC", amount: -600n, reason: "unexplained" }])
  })

  it("a deposit and an outside withdrawal at once: the deposit counts, the loss is unexplained", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 1_000n]]),
      onchain: new Map([["USDC", 1_100n]]),
      deposits: [500n]
    })

    assert.deepStrictEqual(result, {
      deposits: [500n],
      adjustments: [{ asset: "USDC", amount: -400n, reason: "unexplained" }]
    })
  })

  it("shares that arrived: a transfer in", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["USDC", 0n], ["NVDA", 0n]]),
      onchain: new Map([["USDC", 0n], ["NVDA", 3n]]),
      deposits: []
    })

    assert.deepStrictEqual(result.adjustments, [{ asset: "NVDA", amount: 3n, reason: "transferIn" }])
  })

  it("shares that left: a transfer out", () => {
    const result = reconcile({
      opening: false,
      expected: new Map([["NVDA", 10n]]),
      onchain: new Map([["NVDA", 4n]]),
      deposits: []
    })

    assert.deepStrictEqual(result.adjustments, [{ asset: "NVDA", amount: -6n, reason: "transferOut" }])
  })

  it("an asset the ledger has never seen counts from zero", () => {
    const result = reconcile({ opening: false, expected: new Map(), onchain: new Map([["AAPL", 2n]]), deposits: [] })

    assert.deepStrictEqual(result.adjustments, [{ asset: "AAPL", amount: 2n, reason: "transferIn" }])
  })

  it("an account's first check: every difference is its opening balance, deposits included", () => {
    const result = reconcile({
      opening: true,
      expected: new Map([["USDC", 0n], ["NVDA", 1n]]),
      onchain: new Map([["USDC", 500n], ["NVDA", 3n], ["AAPL", 0n]]),
      deposits: [500n]
    })

    assert.deepStrictEqual(result, {
      deposits: [],
      adjustments: [
        { asset: "USDC", amount: 500n, reason: "opening" },
        { asset: "NVDA", amount: 2n, reason: "opening" }
      ]
    })
  })
})
