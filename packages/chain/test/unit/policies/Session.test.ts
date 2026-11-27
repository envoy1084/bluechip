import { localDeployment } from "@bluechip/chain/deployments/Base"
import { agentKey, compileSession, diffSessions, placements } from "@bluechip/chain/policies/Session"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it } from "@effect/vitest"
import { changed, PICKER } from "../../fixtures/Specs.ts"

describe("diffSessions", () => {
  it.each<{ name: string; after: AgentSpec; expected: { remove: Array<string>; add: Array<string> } }>([
    { name: "the same policies", after: PICKER, expected: { remove: [], add: [] } },
    {
      name: "a lower daily budget swaps only the trade policy",
      after: changed(PICKER, { id: "trade", config: { dailyBudget: BigInt(100_000_000) } }),
      expected: { remove: ["custom"], add: ["custom"] }
    },
    {
      name: "a lower stock cap swaps only TradeGuard",
      after: changed(PICKER, { id: "stockCap", config: { maxBps: 2000 } }),
      expected: { remove: ["execution"], add: ["execution"] }
    },
    {
      name: "a smaller largest trade swaps the trade policy and TradeGuard",
      after: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: BigInt(50_000_000) } }),
      expected: { remove: ["custom", "execution"], add: ["custom", "execution"] }
    },
    {
      name: "fewer trades a day swaps only the rate limit",
      after: changed(PICKER, { id: "tradesPerDay", config: { count: 4 } }),
      expected: { remove: ["rateLimit"], add: ["rateLimit"] }
    }
  ])("$name", ({ after, expected }) => {
    const { add, remove } = diffSessions(localDeployment, agentKey("agent_01"), PICKER, after)

    assert.deepStrictEqual(
      { remove: remove.map((policy) => policy.type), add: add.map((policy) => policy.type) },
      expected
    )
  })
})

describe("placements", () => {
  it("a Stock picker's policies, where each is enforced", () => {
    assert.deepStrictEqual(placements(localDeployment, PICKER).map(({ kind, policy }) => [policy, kind]), [
      ["trade", "userOp"],
      ["tradeSize", "rule"],
      ["fairPrice", "rule"],
      ["stockCap", "rule"],
      ["cashReserve", "rule"],
      ["slippageBudget", "rule"],
      ["tradesPerDay", "userOp"],
      ["gasBudget", "userOp"],
      ["anyCall", "action"]
    ])
  })
})

describe("compileSession", () => {
  it("compiles every spec to the same five Namera policies", () => {
    assert.deepStrictEqual(compileSession(localDeployment, PICKER, agentKey("agent_01")).map((policy) => policy.type), [
      "anyCall",
      "custom",
      "execution",
      "rateLimit",
      "gas"
    ])
  })
})
