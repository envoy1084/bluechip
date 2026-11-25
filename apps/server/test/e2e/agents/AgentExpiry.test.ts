import { Conflict } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { Intent } from "@bluechip/domain/intents/Intent"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as TestClock from "effect/testing/TestClock"
import { randomUUID } from "node:crypto"
import { Agents } from "../../../src/modules/agents/Agents.ts"
import { buy } from "../../fixtures/Legs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"

// The server runs on the real clock (see `TestServer`). A session ends 90 days after it is locked, so the expiry
// (`Agents.expire`, the cron's work) runs on a test clock moved to that end, for its own user only. The chain keeps
// the real clock: Namera's own end for the session is still 90 days away, which is what lets the renewal revoke it.
layer(TestAgents.layer, { excludeTestServices: true })("agent expiry", (it) => {
  describe("Agents.expire", () => {
    it.effect("an agent past its session's end is expired, and can't trade", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(agent.lockedUntil!) + 1)
          yield* (yield* Agents).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const expired = yield* user.api.agents.agent({ params: { id: agent.id } })
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })
        const error = yield* Effect.flip(user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("NVDA", 50) }
        }))

        assert.deepStrictEqual(
          [expired.status, sessions.map((session) => session.status), { ...error }],
          ["expired", ["expired"], { ...new Conflict({ reason: "agentBusy" }) }]
        )
      }))

    it.effect("an agent at its session's last moment stays active", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        const { user: me } = yield* user.api.account.me()

        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(agent.lockedUntil!))
          yield* (yield* Agents).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))
        const kept = yield* user.api.agents.agent({ params: { id: agent.id } })

        assert.strictEqual(kept.status, "active")
      }))
  })

  describe("POST /api/agents/:id/renew", () => {
    it.effect("an expired agent renewed with Face ID is active for another 90 days, and trades again", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const { user: me } = yield* user.api.account.me()
        yield* Effect.gen(function*() {
          yield* TestClock.setTime(DateTime.toEpochMillis(agent.lockedUntil!) + 1)
          yield* (yield* Agents).expire({ userId: me.id })
        }).pipe(Effect.provide(TestClock.layer()))

        const prepared = yield* user.api.agents.renew({
          params: { id: agent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })
        const { agent: renewed } = yield* agents.sign(user, prepared, "active")
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })
        const created = yield* user.api.intents.create({
          payload: { requestId: RequestId.make(randomUUID()), agentId: agent.id, leg: buy("AAPL", 50) }
        })
        assert.instanceOf(created, Intent)
        const { intent: filled } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.id === created.id && intent.status === "filled"
        )

        assert.deepStrictEqual(
          [prepared.action, sessions.map((session) => session.status), filled.status],
          ["renew", ["expired", "active"], "filled"]
        )
        assert.isTrue(DateTime.isGreaterThanOrEqualTo(renewed.lockedUntil!, agent.lockedUntil!))
      }))
  })
})
