// What every policy's onchain binding must satisfy, so a new one is checked by being registered.
import { stocks } from "@bluechip/chain/Contracts"
import { tradeGuard, tradeGuardAbi } from "@bluechip/chain/policies/Deployed"
import { refusalOf } from "@bluechip/chain/policies/Refusals"
import { RULES } from "@bluechip/chain/policies/Rules"
import { placements } from "@bluechip/chain/policies/Session"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { AgentSpec, POLICIES, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { type Abi, encodeAbiParameters, encodeErrorResult, type Hex, toFunctionSelector } from "viem"
import { agentOnNewAccount, changed, PICKER, trade, without } from "../support/Agents.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

type AbiError = Extract<Abi[number], { readonly type: "error" }>

const errorsOf = (abi: Abi) => abi.filter((item): item is AbiError => item.type === "error")

// An error as SessionHook reports it: TradeGuard's revert wrapped in `ExecutionPolicyViolation`.
const wrapped = (guard: Hex, reason: Hex): Hex =>
  `${toFunctionSelector("ExecutionPolicyViolation(bytes32,address,bytes)")}${
    encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "bytes" }], [
      `0x${"00".repeat(32)}`,
      guard,
      reason
    ]).slice(2)
  }` as Hex

// An error with every argument zero, or the first one NVDA's token when it names a stock.
const sample = (error: AbiError): Hex =>
  encodeErrorResult({
    abi: [error],
    errorName: error.name,
    args: error.inputs.map((input) => input.type === "address" ? nvda.token : BigInt(0)) as never
  })

const RULE_POLICIES = POLICIES.filter((policy) => policy.kind === "rule").map((policy) => policy.id)

describe("rule bindings", () => {
  it("every rule policy in the catalog has one binding, in the catalog's order", () => {
    assert.deepStrictEqual(RULES.map((rule) => rule.policy), RULE_POLICIES)
  })

  it.each(RULES.flatMap((rule) => errorsOf(rule.abi).map((error) => ({ policy: rule.policy, error }))))(
    "$policy: $error.name decodes to the rule's policy, with a sentence",
    ({ error, policy }) => {
      const refusal = refusalOf(wrapped(tradeGuard, sample(error)))

      assert.deepStrictEqual(
        { policy: refusal?.policy, error: refusal?.error, said: (refusal?.message.length ?? 0) > 0 },
        { policy, error: error.name, said: true }
      )
    }
  )

  it.each(errorsOf(tradeGuardAbi as Abi).filter((error) => error.name !== "PolicyNotInitialized"))(
    "TradeGuard: $name decodes to a policy, with a sentence",
    (error) => {
      const refusal = refusalOf(wrapped(tradeGuard, sample(error)))

      assert.isTrue(refusal !== undefined && refusal.message.length > 0)
    }
  )
})

describe("placements", () => {
  it("every policy in the catalog has a contract that enforces it", () => {
    const spec = new AgentSpec({
      policies: POLICIES.map((policy) => ({ id: policy.id, config: policy.defaults }) as AgentSpec["policies"][number])
    })

    assert.deepStrictEqual(placements(spec).map((placement) => placement.policy), POLICIES.map((policy) => policy.id))
  })
})

// Each optional rule alone with the required policies: the session locks and a fair $20 buy passes.
const ALONE: ReadonlyArray<{ readonly policy: PolicyId; readonly spec: AgentSpec }> = [
  { policy: "stockCap", spec: without(PICKER, "cashReserve", "slippageBudget") },
  { policy: "cashReserve", spec: without(PICKER, "stockCap", "slippageBudget") },
  { policy: "slippageBudget", spec: without(PICKER, "stockCap", "cashReserve") },
  {
    policy: "rebalance",
    spec: changed(
      without(PICKER, "stockCap", "cashReserve", "slippageBudget"),
      { id: "trade", config: { stocks: ["NVDA"], direction: "rebalance" } },
      {
        id: "rebalance",
        config: { targets: [{ asset: "NVDA", weight: 5000 }, { asset: "USDC", weight: 5000 }], triggerBps: 500 }
      }
    )
  }
]

layer(DevnetTest.layer)("each optional rule", (it) => {
  it.effect.each(ALONE)(
    "$policy: a session carrying it alone locks, and a fair $20 buy passes",
    ({ spec }) =>
      Effect.gen(function*() {
        const { address, agent } = yield* agentOnNewAccount({
          bundlerUrl: (yield* Devnet).bundlerUrl,
          fees: BASE_FEES,
          spec
        })

        const decision = yield* simulateAsAgent(agent, trade(nvda, "buy", BigInt(20_000_000), address))

        assert.strictEqual(decision._tag, "Passes")
      })
  )
})
