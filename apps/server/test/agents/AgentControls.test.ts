import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { createAgent, lockedAgent, newCookie } from "../support/agents.ts"
import { call } from "../support/api.ts"

layer(DevnetTest.layer)("agent controls", (it) => {
  describe("POST /api/agents/:id/pause", () => {
    it.effect("a locked agent pauses, and resumes", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const paused = yield* call("POST", `/api/agents/${agent.id}/pause`, { cookie: user.cookie })
        const resumed = yield* call("POST", `/api/agents/${agent.id}/resume`, { cookie: user.cookie })

        assert.deepStrictEqual([paused.json.paused, resumed.json.paused], [true, false])
        yield* user.events.close
      }))

    it.effect("409 agentBusy: a draft has nothing to pause", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const paused = yield* call("POST", `/api/agents/${created.json.agent.id}/pause`, { cookie })

        assert.deepStrictEqual([paused.status, paused.json.reason], [409, "agentBusy"])
      }))
  })

  describe("POST /api/agents/pause-all", () => {
    it.effect("pauses every locked agent and leaves drafts as they are", () =>
      Effect.gen(function*() {
        const { user } = yield* lockedAgent()
        yield* createAgent(user.cookie)

        const all = yield* call("POST", "/api/agents/pause-all", { cookie: user.cookie })

        assert.deepStrictEqual(
          all.json.map((agent: { status: string; paused: boolean }) => [agent.status, agent.paused]),
          [["active", true], ["draft", false]]
        )
        yield* user.events.close
      }))
  })

  describe("POST /api/agents/resume-all", () => {
    it.effect("resumes every paused agent", () =>
      Effect.gen(function*() {
        const { user } = yield* lockedAgent()
        yield* call("POST", "/api/agents/pause-all", { cookie: user.cookie })

        const all = yield* call("POST", "/api/agents/resume-all", { cookie: user.cookie })

        assert.deepStrictEqual(all.json.map((agent: { paused: boolean }) => agent.paused), [false])
        yield* user.events.close
      }))
  })

  describe("GET /api/agents/:id/usage", () => {
    it.effect("a locked agent that hasn't traded has used nothing, policy by policy", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const usage = yield* call("GET", `/api/agents/${agent.id}/usage`, { cookie: user.cookie })

        assert.deepStrictEqual(usage.json, {
          policies: [
            { policy: "trade", unit: "usd", used: "0", limit: "250000000" },
            { policy: "slippageBudget", unit: "usd", used: "0", limit: null },
            { policy: "tradesPerDay", unit: "count", used: "0", limit: "12" },
            { policy: "gasBudget", unit: "wei", used: "0", limit: "1000000000000000" }
          ]
        })
        yield* user.events.close
      }))

    it.effect("a draft has used nothing", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const usage = yield* call("GET", `/api/agents/${created.json.agent.id}/usage`, { cookie })

        assert.deepStrictEqual(usage.json, { policies: [] })
      }))
  })
})
