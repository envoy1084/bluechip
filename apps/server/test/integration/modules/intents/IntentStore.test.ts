import { DevChain } from "@bluechip/chain/DevChain"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as TestClock from "effect/testing/TestClock"
import { randomUUID } from "node:crypto"
import { IntentStore } from "../../../../src/modules/intents/IntentStore.ts"
import { buy } from "../../../fixtures/Legs.ts"
import { TestAgents } from "../../../utils/TestAgents.ts"

// The server runs on the real clock (see `TestServer`); each expiry runs on a test clock moved past the intent's end,
// for its own user only, so other tests' open intents are left alone.
layer(TestAgents.layer, { excludeTestServices: true })("IntentStore", (it) => {
  describe("expire", () => {
    it.effect("an approval left open past its 6 hours expires, and leaves the approvals", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        const { intent: open } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(open.expiresAt!) + 1)
          yield* (yield* IntentStore).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })
        const approvals = yield* user.api.intents.approvals()

        assert.deepStrictEqual([intent.status, approvals], ["expired", []])
      }))

    it.effect("an approval still within its 6 hours stays open", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        const { intent: open } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(open.expiresAt!) - 1)
          yield* (yield* IntentStore).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.strictEqual(intent.status, "needsApproval")
      }))

    it.effect("a trade still waiting past its 6 hours expires", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        yield* (yield* DevChain).setEthBalance(user.account, BigInt(0))
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: waiting } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "waiting"
        )

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(waiting.expiresAt!) + 1)
          yield* (yield* IntentStore).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.strictEqual(intent.status, "expired")
      }))
  })
})
