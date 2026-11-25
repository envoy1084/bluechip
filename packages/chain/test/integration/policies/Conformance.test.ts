// Each optional rule alone with the required policies: the session locks and a fair $20 buy passes.
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { assert, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { nvda, tradeCalls } from "../../fixtures/Market.ts"
import { changed, PICKER, without } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

layer(Layer.provideMerge(TestAgents.layer, DevnetTest.layer))("each optional rule", (it) => {
  it.effect.each<{ readonly policy: PolicyId; readonly spec: AgentSpec }>([
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
  ])("$policy: a session carrying it alone locks, and a fair $20 buy passes", ({ spec }) =>
    Effect.gen(function*() {
      const { address, agent } = yield* (yield* TestAgents).lock({ spec })

      const decision = yield* simulateAsAgent(agent, tradeCalls(nvda, "buy", BigInt(20_000_000), address))

      assert.strictEqual(decision._tag, "Passes")
    }))
})
