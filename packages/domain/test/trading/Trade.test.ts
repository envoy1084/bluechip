import { type TradeEvent, type TradeStatus, transition } from "@bluechip/domain/trading/Trade"
import { assert, describe, it } from "@effect/vitest"
import * as Result from "effect/Result"

describe("transition", () => {
  it.each<
    { name: string; status: TradeStatus; event: TradeEvent["_tag"]; expected: Result.Result<TradeStatus, string> }
  >([
    {
      name: "sending, accepted: confirming",
      status: "sending",
      event: "Accepted",
      expected: Result.succeed("confirming")
    },
    { name: "sending, failed: failed", status: "sending", event: "Failed", expected: Result.succeed("failed") },
    {
      name: "sending, filled: skips confirming",
      status: "sending",
      event: "Filled",
      expected: Result.fail("a sending trade can't fill")
    },
    { name: "confirming, filled: filled", status: "confirming", event: "Filled", expected: Result.succeed("filled") },
    { name: "confirming, failed: failed", status: "confirming", event: "Failed", expected: Result.succeed("failed") },
    {
      name: "confirming, accepted again",
      status: "confirming",
      event: "Accepted",
      expected: Result.fail("a confirming trade can't be accepted")
    },
    {
      name: "filled, accepted",
      status: "filled",
      event: "Accepted",
      expected: Result.fail("a filled trade can't be accepted")
    },
    {
      name: "filled, filled again",
      status: "filled",
      event: "Filled",
      expected: Result.fail("a filled trade can't fill")
    },
    { name: "filled, failed", status: "filled", event: "Failed", expected: Result.fail("a filled trade can't fail") },
    {
      name: "failed, accepted",
      status: "failed",
      event: "Accepted",
      expected: Result.fail("a failed trade can't be accepted")
    },
    { name: "failed, filled", status: "failed", event: "Filled", expected: Result.fail("a failed trade can't fill") },
    {
      name: "failed, failed again",
      status: "failed",
      event: "Failed",
      expected: Result.fail("a failed trade can't fail")
    }
  ])("$name", ({ event, expected, status }) => {
    assert.deepStrictEqual(transition(status, { _tag: event }), expected)
  })
})
