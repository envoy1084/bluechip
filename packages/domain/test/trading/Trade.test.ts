import { type TradeEvent, type TradeStatus, transition } from "@bluechip/domain/trading/Trade"
import { assert, describe, it } from "@effect/vitest"
import * as Result from "effect/Result"

const next = (status: TradeStatus, event: TradeEvent["_tag"]) => transition(status, { _tag: event })

describe("transition", () => {
  it("moves a trade forward: sending → confirming → filled", () => {
    assert.strictEqual(Result.getOrThrow(next("sending", "Accepted")), "confirming")
    assert.strictEqual(Result.getOrThrow(next("confirming", "Filled")), "filled")
  })

  it("lets a trade fail before it settles", () => {
    assert.strictEqual(Result.getOrThrow(next("sending", "Failed")), "failed")
    assert.strictEqual(Result.getOrThrow(next("confirming", "Failed")), "failed")
  })

  it("never changes a settled trade, nor skips confirming", () => {
    for (const settled of ["filled", "failed"] as const) {
      for (const event of ["Accepted", "Filled", "Failed"] as const) {
        assert.isTrue(Result.isFailure(next(settled, event)))
      }
    }
    assert.isTrue(Result.isFailure(next("sending", "Filled")))
    assert.isTrue(Result.isFailure(next("confirming", "Accepted")))
  })
})
