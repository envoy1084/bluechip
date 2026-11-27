import { Usdc } from "@bluechip/domain/market/Units"
import { allowanceAt, FaucetAllowance } from "@bluechip/domain/paper/Faucet"
import { assert, describe, it } from "@effect/vitest"
import * as DateTime from "effect/DateTime"

describe("allowanceAt", () => {
  it.each(
    [
      { name: "nothing granted yet: the whole $10,000", granted: 0n, remaining: 10_000_000_000n },
      { name: "$1,000 granted: $9,000 left", granted: 1_000_000_000n, remaining: 9_000_000_000n },
      { name: "a cent under the limit: a cent left", granted: 9_999_990_000n, remaining: 10_000n },
      { name: "the limit granted: nothing left", granted: 10_000_000_000n, remaining: 0n },
      { name: "over the limit: nothing left", granted: 12_000_000_000n, remaining: 0n }
    ] as const
  )("$name", ({ granted, remaining }) => {
    const allowance = allowanceAt(Usdc.make(granted), DateTime.makeUnsafe("2026-11-27T15:30:00Z"))

    assert.deepStrictEqual(
      allowance,
      new FaucetAllowance({
        limit: Usdc.make(10_000_000_000n),
        remaining: Usdc.make(remaining),
        resetsAt: DateTime.makeUnsafe("2026-11-28T00:00:00Z")
      })
    )
  })

  it("just before midnight UTC: resets at the next midnight", () => {
    const allowance = allowanceAt(Usdc.make(0n), DateTime.makeUnsafe("2026-11-27T23:59:59.999Z"))

    assert.deepStrictEqual(allowance.resetsAt, DateTime.makeUnsafe("2026-11-28T00:00:00Z"))
  })

  it("at midnight UTC: resets at the following one", () => {
    const allowance = allowanceAt(Usdc.make(0n), DateTime.makeUnsafe("2026-11-28T00:00:00Z"))

    assert.deepStrictEqual(allowance.resetsAt, DateTime.makeUnsafe("2026-11-29T00:00:00Z"))
  })
})
