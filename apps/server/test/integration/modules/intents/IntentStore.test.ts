import { DevChain } from "@bluechip/chain/DevChain"
import { Conflict } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent, IntentRequest } from "@bluechip/domain/intents/Intent"
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

    it.effect("409: an approval that expired while you were signing it isn't sent", () =>
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
        const request = yield* user.api.intents.approve({
          params: { id: created.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(open.expiresAt!) + 1)
          yield* (yield* IntentStore).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const error = yield* Effect.flip(user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        }))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.deepStrictEqual(
          [{ ...error }, intent.status, intent.tradeId],
          [{ ...new Conflict({ reason: "intentClosed" }) }, "expired", null]
        )
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

  describe("advance", () => {
    it.effect("409 intentChanged: two moves from the status read, the second loses", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const store = yield* IntentStore
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 150) }
        })
        assert.instanceOf(created, Intent)
        yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "needsApproval"
        )
        const read = (yield* store.find(created.id))!

        yield* store.advance(read, { _tag: "Declined" })
        const error = yield* Effect.flip(store.advance(read, { _tag: "Expired" }))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.deepStrictEqual([{ ...error }, intent.status], [
          { ...new Conflict({ reason: "intentChanged" }) },
          "declined"
        ])
      }))

    it.effect("409 intentChanged: a decline read before an approval was sent loses, and the trade goes on", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const store = yield* IntentStore
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
        const declining = (yield* store.find(created.id))!

        yield* user.api.intents.confirm({
          params: { id: request.id },
          payload: { credential: user.authenticator.authenticate(request.options) }
        })
        const error = yield* Effect.flip(store.advance(declining, { _tag: "Declined" }))
        const intent = yield* user.api.intents.intent({ params: { id: created.id } })

        assert.deepStrictEqual(
          [{ ...error }, declining.status, intent.status === "declined", intent.tradeId !== null],
          [{ ...new Conflict({ reason: "intentChanged" }) }, "awaitingSignature", false, true]
        )
      }))
  })

  describe("expire, a trade of yours claimed for sending", () => {
    it.effect("never sent (the server stopped): failed an hour after its request ran out", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()
        const store = yield* IntentStore
        const request = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: null, leg: buy("AAPL", 20) }
        })
        assert.instanceOf(request, IntentRequest)
        const claimed = yield* store.advance((yield* store.find(request.intent.id))!, { _tag: "Signed" })

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(claimed.expiresAt!) + 60 * 60 * 1000 + 1)
          yield* store.expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const intent = yield* user.api.intents.intent({ params: { id: request.intent.id } })

        assert.deepStrictEqual([claimed.status, intent.status], ["sending", "failed"])
      }))
  })
})
