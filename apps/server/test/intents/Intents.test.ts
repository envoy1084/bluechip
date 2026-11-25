import { DevChain } from "@bluechip/chain/DevChain"
import { Devnet } from "@bluechip/devnet/Devnet"
import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { lockedAgent, type User } from "../support/agents.ts"
import { call } from "../support/api.ts"

const dollars = (amount: number) => String(amount * 1_000_000)

const buy = (symbol: string, amount: number) => ({ symbol, side: "buy", amount: { usdc: dollars(amount) } })

const trade = (user: User, agentId: string | null, leg: object, requestId = randomUUID()) =>
  call("POST", "/api/intents", { cookie: user.cookie, body: { requestId, agentId, leg } })

/** Waits for the intent to reach `status`, from the live events. */
const reaches = (user: User, id: string, status: string) =>
  Effect.map(
    user.events.next((event) =>
      event._tag === "IntentChanged" && event.intent.id === id && event.intent.status === status
    ),
    (event) => (event as { intent: any }).intent
  )

/** Signs an intent request with the user's passkey and sends it. */
const sign = (user: User, request: any) =>
  call("POST", `/api/intents/requests/${request.id}/confirm`, {
    cookie: user.cookie,
    body: { credential: user.authenticator.authenticate(request.options.challenge) }
  })

layer(DevnetTest.layer)("intents", (it) => {
  describe("POST /api/intents through an agent", () => {
    it.effect("a $50 buy within its policies is sent by the agent and filled", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const created = yield* trade(user, agent.id, buy("NVDA", 50))
        const filled = yield* reaches(user, created.json.id, "filled")
        const fill = yield* call("GET", `/api/trades/${filled.tradeId}`, { cookie: user.cookie })

        assert.deepStrictEqual(
          [created.json.status, created.json.executor, filled.decision._tag, fill.json.status],
          ["proposed", "agent", "Passes", "filled"]
        )
        yield* user.events.close
      }))

    it.effect("a $150 buy, over its $100 largest trade, waits for your approval without asking the agent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const created = yield* trade(user, agent.id, buy("NVDA", 150))
        const waiting = yield* reaches(user, created.json.id, "needsApproval")
        const approvals = yield* call("GET", "/api/approvals", { cookie: user.cookie })

        assert.deepStrictEqual(waiting.decision, { _tag: "OverLargestTrade", maxPerTrade: "100000000" })
        assert.deepStrictEqual(approvals.json.map((intent: { id: string }) => intent.id), [created.json.id])
        yield* user.events.close
      }))

    it.effect("an approved trade is signed with your passkey, sent as yours and credited to the agent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const created = yield* trade(user, agent.id, buy("NVDA", 150))
        yield* reaches(user, created.json.id, "needsApproval")

        const request = yield* call("POST", `/api/intents/${created.json.id}/approve`, {
          cookie: user.cookie,
          body: { requestId: randomUUID() }
        })
        yield* sign(user, request.json)
        const filled = yield* reaches(user, created.json.id, "filled")

        assert.deepStrictEqual([request.json.intent.status, request.json.intent.executor], [
          "awaitingSignature",
          "owner"
        ])
        assert.strictEqual(filled.agentId, agent.id)
        yield* user.events.close
      }))

    it.effect("a buy past its 30% cap in one stock is blocked by that policy, and nothing is sent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        // $1,000 of cash and about $500 of NVIDIA: another $100 takes NVIDIA past 30%.
        yield* (yield* Devnet).mintShares(user.address, "NVDA", BigInt(300_000_000))

        const created = yield* trade(user, agent.id, buy("NVDA", 100))
        const blocked = yield* reaches(user, created.json.id, "blocked")

        assert.deepStrictEqual([blocked.decision.policy, blocked.decision.error, blocked.tradeId], [
          "stockCap",
          "OverStockCap",
          null
        ])
        yield* user.events.close
      }))

    it.effect("an account without ETH for gas waits instead of failing", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        yield* (yield* DevChain).setEthBalance(user.address, BigInt(0))

        const created = yield* trade(user, agent.id, buy("NVDA", 50))
        const waiting = yield* reaches(user, created.json.id, "waiting")

        assert.deepStrictEqual([waiting.decision._tag, waiting.decision.reason, waiting.tradeId], [
          "Wait",
          "noGas",
          null
        ])
        yield* user.events.close
      }))

    it.effect("the same request id twice makes one intent", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const requestId = randomUUID()

        const first = yield* trade(user, agent.id, buy("NVDA", 150), requestId)
        const second = yield* trade(user, agent.id, buy("NVDA", 150), requestId)

        assert.strictEqual(second.json.id, first.json.id)
        yield* user.events.close
      }))

    it.effect("409 agentBusy: a paused agent can't trade", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        yield* call("POST", `/api/agents/${agent.id}/pause`, { cookie: user.cookie })

        const created = yield* trade(user, agent.id, buy("NVDA", 50))

        assert.deepStrictEqual([created.status, created.json.reason], [409, "agentBusy"])
        yield* user.events.close
      }))
  })

  describe("approvals", () => {
    it.effect("a declined approval ends, and can't be approved afterwards", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const created = yield* trade(user, agent.id, buy("NVDA", 150))
        yield* reaches(user, created.json.id, "needsApproval")

        const declined = yield* call("POST", `/api/intents/${created.json.id}/decline`, { cookie: user.cookie })
        const approved = yield* call("POST", `/api/intents/${created.json.id}/approve`, {
          cookie: user.cookie,
          body: { requestId: randomUUID() }
        })

        assert.deepStrictEqual([declined.json.status, approved.status, approved.json.reason], [
          "declined",
          409,
          "intentClosed"
        ])
        yield* user.events.close
      }))

    it.effect("pausing the agent cancels its approvals", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const created = yield* trade(user, agent.id, buy("NVDA", 150))
        yield* reaches(user, created.json.id, "needsApproval")

        yield* call("POST", `/api/agents/${agent.id}/pause`, { cookie: user.cookie })
        const after = yield* call("GET", `/api/intents/${created.json.id}`, { cookie: user.cookie })

        assert.strictEqual(after.json.status, "cancelled")
        yield* user.events.close
      }))
  })

  describe("POST /api/intents yourself", () => {
    it.effect("your own buy is prepared for your passkey, then filled as an owner intent", () =>
      Effect.gen(function*() {
        const { user } = yield* lockedAgent()

        const request = yield* trade(user, null, buy("AAPL", 20))
        yield* sign(user, request.json)
        const filled = yield* reaches(user, request.json.intent.id, "filled")

        assert.deepStrictEqual([request.json.intent.status, filled.executor, filled.agentId], [
          "awaitingSignature",
          "owner",
          null
        ])
        yield* user.events.close
      }))
  })

  describe("POST /api/intents/preview", () => {
    it.effect.each([
      { name: "a $50 buy passes", amount: 50, expected: "Passes" },
      { name: "a $150 buy needs your Face ID", amount: 150, expected: "OverLargestTrade" }
    ])("$name", ({ amount, expected }) =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const preview = yield* call("POST", "/api/intents/preview", {
          cookie: user.cookie,
          body: { agentId: agent.id, leg: buy("NVDA", amount) }
        })

        assert.strictEqual(preview.json._tag, expected)
        yield* user.events.close
      }))
  })

  describe("GET /api/intents and /api/audit", () => {
    it.effect("an agent's activity lists its intents, and the audit trail records each step", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const created = yield* trade(user, agent.id, buy("NVDA", 150))
        yield* reaches(user, created.json.id, "needsApproval")

        const activity = yield* call("GET", `/api/intents?agentId=${agent.id}`, { cookie: user.cookie })
        const audit = yield* call("GET", "/api/audit", { cookie: user.cookie })

        assert.deepStrictEqual(activity.json.items.map((intent: { id: string }) => intent.id), [created.json.id])
        assert.deepStrictEqual(
          audit.json.items.filter((event: { subjectId: string }) => event.subjectId === created.json.id)
            .map((event: { action: string }) => event.action),
          ["intent.needsApproval", "intent.deciding"]
        )
        yield* user.events.close
      }))
  })
})
