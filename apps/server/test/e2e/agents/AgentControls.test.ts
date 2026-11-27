import { PolicyUsage } from "@bluechip/domain/agents/Agent"
import { Conflict } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("agent controls", (it) => {
  describe("POST /api/agents/:id/pause", () => {
    it.effect("a locked agent pauses, and resumes", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const paused = yield* user.api.agents.pause({ params: { id: agent.id } })
        const resumed = yield* user.api.agents.resume({ params: { id: agent.id } })

        assert.deepStrictEqual([paused.paused, resumed.paused], [true, false])
      }))

    it.effect("409 agentBusy: a draft has nothing to pause", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)

        const error = yield* Effect.flip(user.api.agents.pause({ params: { id: created.agent.id } }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "agentBusy" }) })
      }))
  })

  describe("POST /api/agents/pause-all", () => {
    it.effect("pauses every locked agent and leaves drafts as they are", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { user } = yield* agents.locked
        yield* agents.create(user)

        const all = yield* user.api.agents.pauseAll()

        assert.deepStrictEqual(all.map((agent) => [agent.status, agent.paused]), [["active", true], ["draft", false]])
      }))
  })

  describe("POST /api/agents/resume-all", () => {
    it.effect("resumes every paused agent", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked
        yield* user.api.agents.pauseAll()

        const all = yield* user.api.agents.resumeAll()

        assert.deepStrictEqual(all.map((agent) => agent.paused), [false])
      }))
  })

  describe("POST /api/agents/remove-all", () => {
    it.effect("one Face ID revokes every agent's session, drafts aside", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const second = yield* agents.sign(user, yield* agents.create(user), "active")
        const draft = yield* agents.create(user)

        const removal = yield* user.api.agents.removeAll({ payload: { requestId: RequestId.make(randomUUID()) } })
        const sent = yield* user.api.agents.confirmRemoveAll({
          params: { id: removal.id },
          payload: { credential: user.authenticator.authenticate(removal.options) }
        })
        // Each removal settles on its own, so they can land in either order.
        const removing = [agent.id, second.agent.id]
        const { agent: first } = yield* user.events.next(
          "AgentChanged",
          (event) => removing.includes(event.agent.id) && event.agent.status === "removed"
        )
        yield* user.events.next(
          "AgentChanged",
          (event) =>
            removing.includes(event.agent.id) && event.agent.id !== first.id && event.agent.status === "removed"
        )
        const all = yield* user.api.agents.list()

        assert.deepStrictEqual(removal.agents.map((removed) => removed.id), [agent.id, second.agent.id])
        assert.deepStrictEqual(sent.map((removed) => removed.status), ["removing", "removing"])
        assert.deepStrictEqual(all.map((listed) => [listed.id, listed.status]), [[draft.agent.id, "draft"]])
      }))

    it.effect("409 agentBusy: nothing to remove", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(
          user.api.agents.removeAll({ payload: { requestId: RequestId.make(randomUUID()) } })
        )

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "agentBusy" }) })
      }))
  })

  describe("GET /api/agents/:id/usage", () => {
    it.effect("a locked agent that hasn't traded has used nothing, policy by policy", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const usage = yield* user.api.agents.usage({ params: { id: agent.id } })

        assert.deepStrictEqual(usage.policies, [
          new PolicyUsage({ policy: "trade", unit: "usd", used: BigInt(0), limit: BigInt(250_000_000) }),
          new PolicyUsage({ policy: "slippageBudget", unit: "usd", used: BigInt(0), limit: null }),
          new PolicyUsage({ policy: "tradesPerDay", unit: "count", used: BigInt(0), limit: BigInt(500) }),
          new PolicyUsage({ policy: "gasBudget", unit: "wei", used: BigInt(0), limit: BigInt(38_000_000_000_000_000) })
        ])
      }))

    it.effect("a draft has used nothing", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)

        const usage = yield* user.api.agents.usage({ params: { id: created.agent.id } })

        assert.deepStrictEqual(usage.policies, [])
      }))
  })
})
