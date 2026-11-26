import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server follows operations onchain on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("the audit log", (it) => {
  describe("GET /api/audit", () => {
    it.effect("a sign-up's first entry is the device that signed in", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const page = yield* user.api.audit.list({ query: {} })

        assert.deepStrictEqual(page.items.map((event) => [event.actor, event.action, event.data]), [
          ["owner", "device.signedIn", { device: "A browser" }]
        ])
      }))

    it.effect("type agent: an agent locked, from your Face ID to its session in force", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const page = yield* user.api.audit.list({ query: { type: "agent" } })

        assert.deepStrictEqual(page.items.map((event) => [event.actor, event.action, event.agentId]), [
          ["system", "agent.active", agent.id],
          ["owner", "agent.locking", agent.id]
        ])
      }))

    it.effect("one agent's entries leave the others out", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const other = yield* agents.sign(user, yield* agents.create(user), "active")
        yield* user.api.agents.pause({ params: { id: other.agent.id } })

        const page = yield* user.api.audit.list({ query: { agentId: agent.id } })

        assert.deepStrictEqual(page.items.map((event) => event.action), ["agent.active", "agent.locking"])
      }))

    it.effect("dates: nothing before the account existed, everything since", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const yesterday = DateTime.subtract(yield* DateTime.now, { days: 1 })

        const before = yield* user.api.audit.list({ query: { to: yesterday } })
        const since = yield* user.api.audit.list({ query: { from: yesterday } })

        assert.deepStrictEqual([before.items.length, since.items.length], [0, 1])
      }))
  })

  describe("GET /api/audit/export", () => {
    it.effect("every entry matching the filter, as the list pages them", () =>
      Effect.gen(function*() {
        const { user } = yield* (yield* TestAgents).locked

        const exported = yield* user.api.audit.export({ query: { type: "agent" } })
        const page = yield* user.api.audit.list({ query: { type: "agent" } })

        assert.deepStrictEqual(exported, page.items)
      }))
  })
})
