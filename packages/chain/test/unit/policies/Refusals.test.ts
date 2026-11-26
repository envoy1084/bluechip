import { rebalanceRuleAbi, tradeGuard } from "@bluechip/chain/policies/Deployed"
import { refusalOf } from "@bluechip/chain/policies/Refusals"
import { assert, describe, it } from "@effect/vitest"
import { encodeAbiParameters, encodeErrorResult, type Hex, toFunctionSelector, zeroAddress } from "viem"
import { nvda } from "../../fixtures/Market.ts"

// `TradeGuard` refusing an operation because `RebalanceRule` reverted with `Overshoots(asset)`, as SessionHook wraps it.
const overshoots = (asset: Hex): Hex =>
  `${toFunctionSelector("ExecutionPolicyViolation(bytes32,address,bytes)")}${
    encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "bytes" }], [
      `0x${"00".repeat(32)}`,
      tradeGuard,
      encodeErrorResult({ abi: rebalanceRuleAbi, errorName: "Overshoots", args: [asset] })
    ]).slice(2)
  }` as Hex

describe("refusalOf", () => {
  it("a rule naming a stock", () => {
    assert.deepStrictEqual(refusalOf(overshoots(nvda.token)), {
      policy: "rebalance",
      error: "Overshoots",
      stock: "NVDA",
      message: "Would push NVDA past its target."
    })
  })

  it("a rule naming cash, the zero address", () => {
    assert.deepStrictEqual(refusalOf(overshoots(zeroAddress)), {
      policy: "rebalance",
      error: "Overshoots",
      stock: null,
      message: "Would push your cash past its target."
    })
  })
})
