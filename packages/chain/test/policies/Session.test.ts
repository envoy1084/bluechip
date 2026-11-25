import { ChainClient } from "@bluechip/chain/ChainClient"
import { stocks } from "@bluechip/chain/Contracts"
import {
  agentSession,
  changeCalls,
  changedGrant,
  compileSession,
  diffSessions,
  guardedTradeCallGas,
  lockedGrant,
  placements,
  renewCalls,
  revokeCalls
} from "@bluechip/chain/policies/Session"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import { readUsage } from "@bluechip/chain/policies/Usage"
import { BASE_FEES } from "@bluechip/devnet/Controls"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, it, layer } from "@effect/vitest"
import { Grant, KernelAccount, Session } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { agentOnNewAccount, changed, PICKER, trade } from "../support/Agents.ts"

const nvda = stocks.find((stock) => stock.symbol === "NVDA")!

const kinds = (spec: AgentSpec, other: AgentSpec) => {
  const { add, remove } = diffSessions(spec, other)
  return { remove: remove.map((policy) => policy.type), add: add.map((policy) => policy.type) }
}

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
    assert.deepStrictEqual(kinds(PICKER, after), expected)
  })
})

describe("placements", () => {
  it("a Stock picker's policies, where each is enforced", () => {
    assert.deepStrictEqual(placements(PICKER).map(({ kind, policy }) => [policy, kind]), [
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
    assert.deepStrictEqual(compileSession(PICKER).map((policy) => policy.type), [
      "anyCall",
      "custom",
      "execution",
      "rateLimit",
      "gas"
    ])
  })
})

const agentWith = Effect.fnUntraced(function*(spec: AgentSpec = PICKER) {
  return yield* agentOnNewAccount({ bundlerUrl: (yield* Devnet).bundlerUrl, fees: BASE_FEES, spec })
})

const now = () => Math.floor(Date.now() / 1000)

layer(DevnetTest.layer)("an agent's session", (it) => {
  it.effect("locked by the owner's call, it is enabled", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { grant } = yield* agentWith()

      assert.isTrue(yield* Effect.promise(() => Grant.isEnabled(chain.client, { grant })))
    }))

  it.effect("a $50 buy counts against the daily budget, the slippage budget, the trade count and the gas", () =>
    Effect.gen(function*() {
      const { address, agent, grant } = yield* agentWith()
      yield* Effect.promise(async () =>
        agent.waitForUserOperationReceipt({
          hash: await agent.sendUserOperation({
            calls: trade(nvda, "buy", BigInt(50_000_000), address),
            callGasLimit: guardedTradeCallGas
          })
        })
      )

      const usage = yield* readUsage({ spec: PICKER, account: address, grant, now: now() })

      const [spent, slippage, trades, gas] = usage
      assert.deepStrictEqual([spent?.policy, spent?.used, spent?.limit], [
        "trade",
        BigInt(50_000_000),
        BigInt(250_000_000)
      ])
      assert.isTrue(slippage!.policy === "slippageBudget" && slippage!.used > 0 && slippage!.used < BigInt(500_000))
      assert.deepStrictEqual([trades?.policy, trades?.used, trades?.limit], ["tradesPerDay", BigInt(1), BigInt(12)])
      assert.isTrue(gas!.policy === "gasBudget" && gas!.used > 0)
    }))

  it.effect("a change to sell only refuses the agent's next buy", () =>
    Effect.gen(function*() {
      const { address, agentFor, grant, send } = yield* agentWith()
      const sellOnly = changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } })

      const change = changeCalls(grant, PICKER, sellOnly)
      const landed = yield* send(change.calls)
      const decision = yield* simulateAsAgent(
        yield* agentFor(changedGrant(grant, change.session)),
        trade(nvda, "buy", BigInt(20_000_000), address)
      )

      assert.isTrue(landed.success)
      assert.strictEqual(decision._tag === "Refused" ? decision.refusal.policy : decision._tag, "trade")
    }))

  it.effect("a change of the stock cap keeps what was spent today", () =>
    Effect.gen(function*() {
      const { address, agent, grant, send } = yield* agentWith()
      yield* Effect.promise(async () =>
        agent.waitForUserOperationReceipt({
          hash: await agent.sendUserOperation({
            calls: trade(nvda, "buy", BigInt(50_000_000), address),
            callGasLimit: guardedTradeCallGas
          })
        })
      )
      const capped = changed(PICKER, { id: "stockCap", config: { maxBps: 2000 } })

      const change = changeCalls(grant, PICKER, capped)
      yield* send(change.calls)
      const [spent] = yield* readUsage({
        spec: capped,
        account: address,
        grant: changedGrant(grant, change.session),
        now: now()
      })

      assert.strictEqual(spent?.used, BigInt(50_000_000))
    }))

  it.effect("a renewal enables a new key's session and revokes the old one", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { address, grant, send } = yield* agentWith()
      const owner = yield* Effect.promise(() =>
        KernelAccount.from({ client: chain.client, address, owner: privateKeyToAccount(generatePrivateKey()) })
      )
      const session = agentSession({
        spec: PICKER,
        signer: privateKeyToAccount(generatePrivateKey()).address,
        validUntil: Session.expiresIn({ days: 90 })
      })

      const landed = yield* send(renewCalls(grant, session))
      const renewed = yield* lockedGrant(owner, session)

      assert.isTrue(landed.success)
      assert.deepStrictEqual(
        yield* Effect.promise(() =>
          Promise.all([
            Grant.isEnabled(chain.client, { grant: renewed }),
            Grant.isEnabled(chain.client, { grant })
          ])
        ),
        [true, false]
      )
    }))

  it.effect("a revoked session is no longer enabled", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { grant, send } = yield* agentWith()

      const revoked = yield* send(revokeCalls(grant))

      assert.isTrue(revoked.success)
      assert.isFalse(yield* Effect.promise(() => Grant.isEnabled(chain.client, { grant })))
    }))
})
