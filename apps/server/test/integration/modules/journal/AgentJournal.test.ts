import { Devnet } from "@bluechip/devnet/Devnet"
import { NotFound } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { AgentJournal } from "../../../../src/modules/journal/AgentJournal.ts"
import { buy } from "../../../fixtures/Legs.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("AgentJournal", (it) => {
  describe("an agent's trades", () => {
    it.effect("a trade within its policies: sent, then filled", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 50) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next("IntentChanged", ({ intent }) => intent.id === created.id && intent.status === "filled")

        const entries = yield* (yield* AgentJournal).read({ id: user.id, account: user.account }, agent.id)

        assert.deepStrictEqual(entries.map((entry) => [entry.kind, entry.entry, entry.refs]), [
          ["intent", "Buy $50.00 of Apple: filled.", { intentId: created.id }],
          ["intent", "Buy $50.00 of Apple, sent within its policies. Why: You asked this agent to trade.", {
            intentId: created.id
          }]
        ])
      }))

    it.effect("a trade over its largest trade waits for your approval", () =>
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

        const entries = yield* (yield* AgentJournal).read({ id: user.id, account: user.account }, agent.id)

        assert.deepStrictEqual(entries.map((entry) => entry.entry), [
          "Buy $150.00 of NVIDIA. Over the agent's largest trade ($100): it needs your Face ID. " +
          "Why: You asked this agent to trade."
        ])
      }))

    it.effect("a refused trade is blocked, with the policy in words", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* (yield* Devnet).mintShares(user.account, "NVDA", BigInt(300_000_000))
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 100) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "blocked"
        )

        const entries = yield* (yield* AgentJournal).read({ id: user.id, account: user.account }, agent.id)

        assert.deepStrictEqual(entries.map((entry) => entry.entry), [
          "Buy $100.00 of NVIDIA, blocked by Max in one stock: Would put too much of your money in NVDA. " +
          "Why: You asked this agent to trade."
        ])
      }))
  })

  describe("read", () => {
    it.effect("another user's agent isn't found", () =>
      Effect.gen(function*() {
        const { agent } = yield* (yield* TestAgents).locked
        const stranger = yield* (yield* TestUsers).signUp

        const error = yield* (yield* AgentJournal).read({ id: stranger.id, account: stranger.account }, agent.id).pipe(
          Effect.flip
        )

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "agent", id: agent.id }) })
      }))
  })
})
