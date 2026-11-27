// What every policy's onchain binding must satisfy, so a new one is checked by being registered.
import { localDeployment } from "@bluechip/chain/deployments/Base"
import { tradeGuardAbi } from "@bluechip/chain/policies/Deployed"
import { refusalOf } from "@bluechip/chain/policies/Refusals"
import { RULES } from "@bluechip/chain/policies/Rules"
import { placements } from "@bluechip/chain/policies/Session"
import { AgentSpec, POLICIES } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import { type Abi, encodeAbiParameters, encodeErrorResult, type Hex, toFunctionSelector } from "viem"
import { nvda } from "../../fixtures/Market.ts"

type AbiError = Extract<Abi[number], { readonly type: "error" }>

describe("rule bindings", () => {
  it("every rule policy in the catalog has one binding, in the catalog's order", () => {
    assert.deepStrictEqual(
      RULES.map((rule) => rule.policy),
      POLICIES.filter((policy) => policy.kind === "rule").map((policy) => policy.id)
    )
  })

  it.each(
    RULES.flatMap((rule) =>
      rule.abi
        .filter((item): item is AbiError => item.type === "error")
        .map((error) => ({ policy: rule.policy, error }))
    )
  )("$policy: $error.name decodes to the rule's policy, with a sentence", ({ error, policy }) => {
    // The error with every argument zero, or the first one NVDA's token when it names a stock, as SessionHook
    // reports it: TradeGuard's revert wrapped in `ExecutionPolicyViolation`.
    const reason = encodeErrorResult({
      abi: [error],
      errorName: error.name,
      args: error.inputs.map((input) => input.type === "address" ? nvda.token : BigInt(0)) as never
    })
    const violation = `${toFunctionSelector("ExecutionPolicyViolation(bytes32,address,bytes)")}${
      encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "bytes" }], [
        `0x${"00".repeat(32)}`,
        localDeployment.policies.tradeGuard,
        reason
      ]).slice(2)
    }` as Hex

    const refusal = refusalOf(localDeployment, violation)

    assert.deepStrictEqual(
      { policy: refusal?.policy, error: refusal?.error, said: (refusal?.message.length ?? 0) > 0 },
      { policy, error: error.name, said: true }
    )
  })

  it.each(
    (tradeGuardAbi as Abi).filter((item): item is AbiError =>
      item.type === "error" && item.name !== "PolicyNotInitialized"
    )
  )("TradeGuard: $name decodes to a policy, with a sentence", (error) => {
    const reason = encodeErrorResult({
      abi: [error],
      errorName: error.name,
      args: error.inputs.map((input) => input.type === "address" ? nvda.token : BigInt(0)) as never
    })
    const violation = `${toFunctionSelector("ExecutionPolicyViolation(bytes32,address,bytes)")}${
      encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "bytes" }], [
        `0x${"00".repeat(32)}`,
        localDeployment.policies.tradeGuard,
        reason
      ]).slice(2)
    }` as Hex

    const refusal = refusalOf(localDeployment, violation)

    assert.isTrue(refusal !== undefined && refusal.message.length > 0)
  })
})

describe("placements", () => {
  it("every policy in the catalog has a contract that enforces it", () => {
    const spec = new AgentSpec({
      policies: POLICIES.map((policy) => ({ id: policy.id, config: policy.defaults }) as AgentSpec["policies"][number])
    })

    assert.deepStrictEqual(
      placements(localDeployment, spec).map((placement) => placement.policy),
      POLICIES.map((policy) => policy.id)
    )
  })
})
