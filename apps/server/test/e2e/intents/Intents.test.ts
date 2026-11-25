import { DevChain } from "@bluechip/chain/DevChain"
import { Devnet } from "@bluechip/devnet/Devnet"
import { Conflict } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { buy } from "../../fixtures/Legs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("intents", (it) => {
  describe("POST /api/intents through an agent", () => {
    it.effect("a $50 buy within its policies is sent by the agent and filled", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "filled"
        )
        const fill = yield* user.api.trades.trade({ params: { id: filled.tradeId! } })

        assert.deepStrictEqual(
          [created.status, created.executor, filled.decision?._tag, fill.status],
          ["proposed", "agent", "Passes", "filled"]
        )
      }))

    it.effect("a $150 buy, over its $100 largest trade, waits for your approval without asking the agent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        const { intent: waiting } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )
        const approvals = yield* user.api.intents.approvals()

        assert.deepStrictEqual(waiting.decision, {
          _tag: "OverLargestTrade",
          maxPerTrade: Usdc.make(BigInt(100_000_000))
        })
        assert.deepStrictEqual(approvals.map((intent) => intent.id), [created.id])
      }))

    it.effect("an approved trade is signed with your passkey, sent as yours and credited to the agent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        const request = yield* user.api.intents.approve({
          params: { id: created.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })
        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "filled"
        )

        assert.deepStrictEqual([request.intent.status, request.intent.executor], ["awaitingSignature", "owner"])
        assert.strictEqual(filled.agentId, agent.id)
      }))

    it.effect("a buy past its 30% cap in one stock is blocked by that policy, and nothing is sent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        // $1,000 of cash and about $500 of NVIDIA: another $100 takes NVIDIA past 30%.
        yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(300_000_000))

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 100) }
        })
        assert.instanceOf(created, Intent)
        const { intent: blocked } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "blocked"
        )

        assert.deepStrictEqual([blocked.decision, blocked.tradeId], [{
          _tag: "Refused",
          policy: "stockCap",
          error: "OverStockCap",
          stock: "NVDA",
          message: "Would put too much of your money in NVDA."
        }, null])
      }))

    it.effect("an account without ETH for gas waits instead of failing", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* (yield* DevChain).setEthBalance(user.account, BigInt(0))

        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: waiting } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "waiting"
        )

        assert.deepStrictEqual(
          waiting.decision?._tag === "Wait" ? [waiting.decision.reason, waiting.tradeId] : [],
          ["noGas", null]
        )
      }))

    it.effect("the same request id twice makes one intent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const payload = { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }

        const first = yield* user.api.intents.create({ payload })
        const second = yield* user.api.intents.create({ payload })

        assert.strictEqual(second.id, first.id)
      }))

    it.effect("409 agentBusy: a paused agent can't trade", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* user.api.agents.pause({ params: { id: agent.id } })

        const error = yield* Effect.flip(user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "agentBusy" }) })
      }))
  })

  describe("approvals", () => {
    it.effect("a declined approval ends, and can't be approved afterwards", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        const declined = yield* user.api.intents.decline({ params: { id: created.id } })
        const error = yield* Effect.flip(user.api.intents.approve({
          params: { id: created.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        }))

        assert.strictEqual(declined.status, "declined")
        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "intentClosed" }) })
      }))

    it.effect("pausing the agent cancels its approvals", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        yield* user.api.agents.pause({ params: { id: agent.id } })
        const after = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.strictEqual(after.status, "cancelled")
      }))
  })

  describe("POST /api/intents yourself", () => {
    it.effect("your own buy is prepared for your passkey, then filled as an owner intent", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked

        const request = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: null, leg: buy("AAPL", 20) }
        })
        assert.instanceOf(request, IntentRequest)
        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === request.intent.id && intent.status === "filled"
        )

        assert.deepStrictEqual([request.intent.status, filled.executor, filled.agentId], [
          "awaitingSignature",
          "owner",
          null
        ])
      }))
  })

  describe("POST /api/intents/preview", () => {
    it.effect.each([
      { name: "a $50 buy passes", dollars: 50, expected: "Passes" },
      { name: "a $150 buy needs your Face ID", dollars: 150, expected: "OverLargestTrade" }
    ])("$name", ({ dollars, expected }) =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const decision = yield* user.api.intents.preview({ payload: { agentId: agent.id, leg: buy("NVDA", dollars) } })

        assert.strictEqual(decision._tag, expected)
      }))
  })

  describe("GET /api/intents and /api/audit", () => {
    it.effect("an agent's activity lists its intents, and the audit trail records each step", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        const activity = yield* user.api.intents.list({ query: { agentId: agent.id } })
        const audit = yield* user.api.intents.audit({ query: {} })

        assert.deepStrictEqual(activity.items.map((intent) => intent.id), [created.id])
        assert.deepStrictEqual(
          audit.items.filter((event) => event.subjectId === created.id).map((event) => event.action),
          ["intent.needsApproval", "intent.deciding"]
        )
      }))
  })
})
