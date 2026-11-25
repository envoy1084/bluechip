import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { Limits } from "@bluechip/domain/agents/Limits"
import { draftLimits } from "@bluechip/domain/agents/Templates"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { randomUUID } from "node:crypto"
import { call, fundedUser, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"

const encode = (limits: Limits) => Schema.encodeSync(Schema.toCodecJson(Limits))(limits)

const PICKER = draftLimits({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

type User = Effect.Success<ReturnType<typeof fundedUser>>

const createAgent = (cookie: string, limits: Limits = PICKER, requestId: string = randomUUID()) =>
  call("POST", "/api/agents", {
    cookie,
    body: { requestId, name: "Tech picker", template: "stockPicker", limits: encode(limits) }
  })

/** Signs a prepared request with the user's passkey and sends it; waits for the agent to reach `status`. */
const signed = Effect.fnUntraced(function*(user: User, request: any, status: string) {
  const credential = user.authenticator.authenticate(request.options.challenge)
  const sent = yield* call("POST", `/api/agents/requests/${request.id}/confirm`, {
    cookie: user.cookie,
    body: { credential }
  })
  const settled = yield* user.events.next((event) =>
    event._tag === "AgentChanged" && event.agent.id === request.agent.id && event.agent.status === status
  )
  return { sent, agent: settled.agent }
})

/** A funded user with a Stock picker locked onchain. */
const lockedAgent = Effect.fnUntraced(function*() {
  const user = yield* fundedUser()
  const created = yield* createAgent(user.cookie)
  const { agent } = yield* signed(user, created.json, "active")
  return { user, agent }
})

// A new user with gas for owner operations (the devnet's accounts pay their own), without their event stream.
const newCookie = Effect.gen(function*() {
  const user = yield* fundedUser()
  yield* user.events.close
  return user.cookie
})

// A new user with a passkey of their own, and no money.
const strangerCookie = Effect.suspend(() =>
  Effect.map(
    signUp(softwareAuthenticator({ rpId: "localhost", origin })),
    (created) => `bluechip_session=${created.session}`
  )
)

layer(DevnetTest.layer)("agents", (it) => {
  describe("POST /api/agents", () => {
    it.effect("a Stock picker is created as a draft, with its lock prepared for the passkey", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie)

        assert.strictEqual(created.status, 200)
        assert.strictEqual(created.json.action, "lock")
        assert.strictEqual(created.json.agent.status, "draft")
        assert.strictEqual(created.json.agent.name, "Tech picker")
        assert.deepStrictEqual(created.json.agent.limits, encode(PICKER))
      }))

    it.effect("422 InvalidLimits: a Weekly buyer's daily budget over its $500 ceiling", () =>
      Effect.gen(function*() {
        const limits = draftLimits({ template: "weeklyBuyer", preset: "active", stocks: ["NVDA"], targets: [] })
        const created = yield* call("POST", "/api/agents", {
          cookie: yield* newCookie,
          body: {
            requestId: randomUUID(),
            name: "Weekly",
            template: "weeklyBuyer",
            limits: encode(new Limits({ ...limits, dailyBudget: BigInt(600_000_000) as never }))
          }
        })

        assert.strictEqual(created.status, 422)
        assert.deepStrictEqual(created.json.problems.map((problem: { field: string }) => problem.field), [
          "dailyBudget"
        ])
      }))

    it.effect("the same request id twice prepares one agent", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const requestId = randomUUID()

        const first = yield* createAgent(cookie, PICKER, requestId)
        const second = yield* createAgent(cookie, PICKER, requestId)

        assert.deepStrictEqual([second.json.id, second.json.agent.id], [first.json.id, first.json.agent.id])
      }))
  })

  describe("POST /api/agents/requests/:id/confirm", () => {
    it.effect("a signed lock enables the agent's session: active, locked for 90 days", () =>
      Effect.gen(function*() {
        const user = yield* fundedUser()
        const created = yield* createAgent(user.cookie)

        const { agent, sent } = yield* signed(user, created.json, "active")

        assert.strictEqual(sent.json.status, "locking")
        const days = (Date.parse(agent.lockedUntil) - Date.now()) / 86_400_000
        assert.isTrue(days > 89.9 && days <= 90)
        yield* user.events.close
      }))

    it.effect("403: the same signature confirmed twice", () =>
      Effect.gen(function*() {
        const user = yield* fundedUser()
        const created = yield* createAgent(user.cookie)
        const credential = user.authenticator.authenticate(created.json.options.challenge)
        const path = `/api/agents/requests/${created.json.id}/confirm`
        yield* call("POST", path, { cookie: user.cookie, body: { credential } })

        const replay = yield* call("POST", path, { cookie: user.cookie, body: { credential } })

        assert.strictEqual(replay.status, 403)
        yield* user.events.close
      }))
  })

  describe("POST /api/agents/:id/limits", () => {
    it.effect("a signed change locks the new limits in place", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const tighter = new Limits({ ...PICKER, dailyBudget: BigInt(100_000_000) as never })
        const prepared = yield* call("POST", `/api/agents/${agent.id}/limits`, {
          cookie: user.cookie,
          body: { requestId: randomUUID(), limits: encode(tighter) }
        })

        const { agent: changed, sent } = yield* signed(user, prepared.json, "active")

        assert.strictEqual(sent.json.status, "updating")
        assert.deepStrictEqual([changed.limits.dailyBudget, changed.pendingLimits], ["100000000", null])
        yield* user.events.close
      }))

    it.effect("409 agentBusy: a draft has no lock to change", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const prepared = yield* call("POST", `/api/agents/${created.json.agent.id}/limits`, {
          cookie,
          body: { requestId: randomUUID(), limits: encode(PICKER) }
        })

        assert.deepStrictEqual([prepared.status, prepared.json.reason], [409, "agentBusy"])
      }))
  })

  describe("POST /api/agents/:id/remove", () => {
    it.effect("a draft is removed at once, with nothing to sign", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const removed = yield* call("POST", `/api/agents/${created.json.agent.id}/remove`, {
          cookie,
          body: { requestId: randomUUID() }
        })

        assert.strictEqual(removed.json.status, "removed")
      }))

    it.effect("a signed removal revokes the session: removed, and gone from the list", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const prepared = yield* call("POST", `/api/agents/${agent.id}/remove`, {
          cookie: user.cookie,
          body: { requestId: randomUUID() }
        })

        yield* signed(user, prepared.json, "removed")
        const listed = yield* call("GET", "/api/agents", { cookie: user.cookie })

        assert.deepStrictEqual(listed.json, [])
        yield* user.events.close
      }))
  })

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

  describe("GET /api/agents/:id/usage", () => {
    it.effect("a locked agent that hasn't traded has used nothing", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const usage = yield* call("GET", `/api/agents/${agent.id}/usage`, { cookie: user.cookie })

        assert.deepStrictEqual(usage.json, { spentToday: "0", tradesToday: 0, slippageThisWeek: "0" })
        yield* user.events.close
      }))
  })

  describe("GET /api/agents/:id", () => {
    it.effect("404: another user's agent", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie)

        const found = yield* call("GET", `/api/agents/${created.json.agent.id}`, { cookie: yield* strangerCookie })

        assert.strictEqual(found.status, 404)
      }))
  })
})
