import { ChainClient } from "@bluechip/chain/ChainClient"
import {
  agentSession,
  changeCalls,
  changedGrant,
  guardedTradeCallGas,
  lockCalls,
  lockedGrant,
  renewCalls,
  revokeCalls
} from "@bluechip/chain/policies/Session"
import { simulateAsAgent } from "@bluechip/chain/policies/Simulate"
import { readUsage } from "@bluechip/chain/policies/Usage"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, layer } from "@effect/vitest"
import { Grant, KernelAccount, Session } from "@namera-ai/sdk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { nvda, tradeCalls } from "../../fixtures/Market.ts"
import { changed, PICKER } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

layer(Layer.provideMerge(TestAgents.layer, DevnetTest.layer))("an agent's session", (it) => {
  it.effect("locked by the owner's call, it is enabled", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { grant } = yield* (yield* TestAgents).lock()

      assert.isTrue(yield* chain.use("Grant.isEnabled", (client) => Grant.isEnabled(client, { grant })))
    }))

  it.effect("a $50 buy counts against the daily budget, the slippage budget, the trade count and the gas", () =>
    Effect.gen(function*() {
      const { address, grant, trade } = yield* (yield* TestAgents).lock()
      yield* trade(tradeCalls(nvda, "buy", BigInt(50_000_000), address), guardedTradeCallGas)

      const usage = yield* readUsage({ spec: PICKER, account: address, grant, now: Math.floor(Date.now() / 1000) })

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
      const { address, agentFor, grant, send } = yield* (yield* TestAgents).lock()
      const sellOnly = changed(PICKER, { id: "trade", config: { direction: "sell", dailyBudget: BigInt(0) } })

      const change = changeCalls(grant, PICKER, sellOnly)
      const landed = yield* send(change.calls)
      const decision = yield* simulateAsAgent(
        yield* agentFor(changedGrant(grant, change.session)),
        tradeCalls(nvda, "buy", BigInt(20_000_000), address)
      )

      assert.isTrue(landed.success)
      assert.strictEqual(decision._tag === "Refused" ? decision.refusal.policy : decision._tag, "trade")
    }))

  it.effect("a change of the stock cap keeps what was spent today", () =>
    Effect.gen(function*() {
      const { address, grant, send, trade } = yield* (yield* TestAgents).lock()
      yield* trade(tradeCalls(nvda, "buy", BigInt(50_000_000), address), guardedTradeCallGas)
      const capped = changed(PICKER, { id: "stockCap", config: { maxBps: 2000 } })

      const change = changeCalls(grant, PICKER, capped)
      yield* send(change.calls)
      const [spent] = yield* readUsage({
        spec: capped,
        account: address,
        grant: changedGrant(grant, change.session),
        now: Math.floor(Date.now() / 1000)
      })

      assert.strictEqual(spent?.used, BigInt(50_000_000))
    }))

  it.effect("a renewal enables a new key's session and revokes the old one", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { address, grant, send } = yield* (yield* TestAgents).lock()
      const owner = yield* chain.use(
        "KernelAccount.from",
        (client) => KernelAccount.from({ client, address, owner: privateKeyToAccount(generatePrivateKey()) })
      )
      const session = agentSession({
        spec: PICKER,
        signer: privateKeyToAccount(generatePrivateKey()).address,
        validUntil: Session.expiresIn({ days: 90 })
      })

      const landed = yield* send(renewCalls(grant, session))
      const renewed = yield* lockedGrant(owner, session)

      const enabled = yield* chain.use(
        "Grant.isEnabled",
        (client) => Promise.all([Grant.isEnabled(client, { grant: renewed }), Grant.isEnabled(client, { grant })])
      )
      assert.isTrue(landed.success)
      assert.deepStrictEqual(enabled, [true, false])
    }))

  it.effect("a revoked session is no longer enabled", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { grant, send } = yield* (yield* TestAgents).lock()

      const revoked = yield* send(revokeCalls(grant))

      assert.isTrue(revoked.success)
      assert.isFalse(yield* chain.use("Grant.isEnabled", (client) => Grant.isEnabled(client, { grant })))
    }))

  it.effect("every agent of an account is revoked in one operation", () =>
    Effect.gen(function*() {
      const chain = yield* ChainClient
      const { account, grant, send } = yield* (yield* TestAgents).lock()
      const second = agentSession({
        spec: PICKER,
        signer: privateKeyToAccount(generatePrivateKey()).address,
        validUntil: Session.expiresIn({ days: 90 })
      })
      yield* send(lockCalls(second))
      const secondGrant = yield* lockedGrant(account, second)

      const revoked = yield* send([...revokeCalls(grant), ...revokeCalls(secondGrant)])

      const enabled = yield* chain.use(
        "Grant.isEnabled",
        (client) => Promise.all([Grant.isEnabled(client, { grant }), Grant.isEnabled(client, { grant: secondGrant })])
      )
      assert.isTrue(revoked.success)
      assert.deepStrictEqual(enabled, [false, false])
    }))
})
