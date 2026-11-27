import { bundlerErrorCode, errorKind } from "@bluechip/chain/ChainTelemetry"
import { assert, describe, it } from "@effect/vitest"

describe("errorKind", () => {
  it.each([
    [Object.assign(new Error("took too long"), { name: "TimeoutError" }), "timeout"],
    [new Error("HTTP request failed", { cause: new Error("Status: 429") }), "rate_limited"],
    [Object.assign(new Error("over the limit"), { name: "LimitExceededRpcError" }), "rate_limited"],
    [
      new Error("call failed", { cause: Object.assign(new Error("nope"), { name: "ContractFunctionRevertedError" }) }),
      "reverted"
    ],
    [new Error("execution reverted: OverStockCap"), "reverted"],
    [new Error("socket hang up"), "other"],
    ["not an error", "other"]
  ])("%s is %s", (cause, expected) => {
    assert.strictEqual(errorKind(cause), expected)
  })
})

describe("bundlerErrorCode", () => {
  it.each([
    [new Error("UserOperation reverted during simulation with reason: AA21 didn't pay prefund"), "AA21"],
    [new Error("send failed", { cause: Object.assign(new Error("Too many requests"), { code: -32503 }) }), "-32503"],
    [new Error("send failed", { cause: new Error("AA25 invalid account nonce") }), "AA25"],
    [new Error("socket hang up"), "unknown"]
  ])("%s is %s", (cause, expected) => {
    assert.strictEqual(bundlerErrorCode(cause), expected)
  })
})
