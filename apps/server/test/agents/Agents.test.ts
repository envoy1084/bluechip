import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { changed, createAgent, encode, lockedAgent, newCookie, PICKER, signed } from "../support/agents.ts"
import { call, fundedUser, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"

// A new user with a passkey of their own, and no money.
const strangerCookie = Effect.suspend(() =>
  Effect.map(
    signUp(softwareAuthenticator({ rpId: "localhost", origin })),
    (created) => `bluechip_session=${created.session}`
  )
)

const statuses = (sessions: ReadonlyArray<{ status: string }>) => sessions.map((session) => session.status)

layer(DevnetTest.layer)("agents", (it) => {
  describe("POST /api/agents", () => {
    it.effect("a Stock picker from its template is created as a draft, with its lock prepared for the passkey", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie)

        assert.strictEqual(created.status, 200)
        assert.deepStrictEqual(
          {
            action: created.json.action,
            status: created.json.agent.status,
            template: created.json.agent.template,
            spec: created.json.agent.spec,
            pendingSpec: created.json.agent.pendingSpec
          },
          { action: "lock", status: "draft", template: "stockPicker", spec: encode(PICKER), pendingSpec: null }
        )
      }))

    it.effect("an agent built from scratch, without bluechip's hidden policies: they are added", () =>
      Effect.gen(function*() {
        const required = ["trade", "tradeSize", "fairPrice", "tradesPerDay"]
        const created = yield* createAgent(yield* newCookie, {
          template: null,
          spec: new AgentSpec({ policies: PICKER.policies.filter((entry) => required.includes(entry.id)) })
        })

        assert.deepStrictEqual(
          created.json.agent.spec.policies.map((entry: { id: string }) => entry.id),
          ["trade", "tradeSize", "fairPrice", "tradesPerDay", "gasBudget", "anyCall"]
        )
      }))

    it.effect("422 InvalidSpec: the largest trade over the daily budget", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie, {
          spec: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: BigInt(300_000_000) } })
        })

        assert.deepStrictEqual([created.status, created.json.problems], [422, [{
          policy: "tradeSize",
          field: "maxPerTrade",
          message: "Can't be more than the daily budget ($250)."
        }]])
      }))

    it.effect("404: a saved template that isn't the user's", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie, { template: typeid("template").toString() })

        assert.deepStrictEqual([created.status, created.json.resource], [404, "template"])
      }))

    it.effect("404: a template id that isn't one", () =>
      Effect.gen(function*() {
        const created = yield* createAgent(yield* newCookie, { template: "template_01jd0000000000000000000000" })

        assert.deepStrictEqual([created.status, created.json.resource], [404, "template"])
      }))

    it.effect("the same request id twice prepares one agent", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const requestId = randomUUID()

        const first = yield* createAgent(cookie, { requestId })
        const second = yield* createAgent(cookie, { requestId })

        assert.deepStrictEqual([second.json.id, second.json.agent.id], [first.json.id, first.json.agent.id])
      }))
  })

  describe("POST /api/agents/requests/:id/confirm", () => {
    it.effect("a signed lock enables the agent's session: active, locked for 90 days, its first session", () =>
      Effect.gen(function*() {
        const user = yield* fundedUser()
        const created = yield* createAgent(user.cookie)

        const { agent, sent } = yield* signed(user, created.json, "active")
        const sessions = yield* call("GET", `/api/agents/${agent.id}/sessions`, { cookie: user.cookie })

        assert.strictEqual(sent.json.status, "locking")
        const days = (Date.parse(agent.lockedUntil) - Date.now()) / 86_400_000
        assert.isTrue(days > 89.9 && days <= 90)
        assert.deepStrictEqual(statuses(sessions.json), ["active"])
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

  describe("POST /api/agents/:id/sessions", () => {
    it.effect("a signed change locks the new policies, and the old session is kept as replaced", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const tighter = changed(PICKER, { id: "trade", config: { dailyBudget: BigInt(100_000_000) } })
        const prepared = yield* call("POST", `/api/agents/${agent.id}/sessions`, {
          cookie: user.cookie,
          body: { requestId: randomUUID(), spec: encode(tighter) }
        })

        const { agent: after, sent } = yield* signed(user, prepared.json, "active")
        const sessions = yield* call("GET", `/api/agents/${agent.id}/sessions`, { cookie: user.cookie })

        assert.deepStrictEqual([sent.json.status, after.spec, after.lockedUntil], [
          "updating",
          encode(tighter),
          agent.lockedUntil
        ])
        assert.deepStrictEqual(statuses(sessions.json), ["replaced", "active"])
        yield* user.events.close
      }))

    it.effect("a change prepared and never signed stays out of the history", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        yield* call("POST", `/api/agents/${agent.id}/sessions`, {
          cookie: user.cookie,
          body: { requestId: randomUUID(), spec: encode(changed(PICKER, { id: "stockCap", config: { maxBps: 2000 } })) }
        })

        const sessions = yield* call("GET", `/api/agents/${agent.id}/sessions`, { cookie: user.cookie })

        assert.deepStrictEqual(statuses(sessions.json), ["active"])
        yield* user.events.close
      }))

    it.effect("422 InvalidSpec: a change without a trade policy", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()

        const prepared = yield* call("POST", `/api/agents/${agent.id}/sessions`, {
          cookie: user.cookie,
          body: { requestId: randomUUID(), spec: { policies: encode(PICKER).policies.slice(1) } }
        })

        assert.deepStrictEqual([prepared.status, prepared.json.problems[0].policy], [422, "trade"])
        yield* user.events.close
      }))

    it.effect("409 agentBusy: a draft has no lock to change", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const prepared = yield* call("POST", `/api/agents/${created.json.agent.id}/sessions`, {
          cookie,
          body: { requestId: randomUUID(), spec: encode(PICKER) }
        })

        assert.deepStrictEqual([prepared.status, prepared.json.reason], [409, "agentBusy"])
      }))
  })

  describe("POST /api/agents/:id/renew", () => {
    it.effect("a signed renewal locks the same policies with a new key for another 90 days", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* lockedAgent()
        const prepared = yield* call("POST", `/api/agents/${agent.id}/renew`, {
          cookie: user.cookie,
          body: { requestId: randomUUID() }
        })

        const { agent: renewed } = yield* signed(user, prepared.json, "active")
        const sessions = yield* call("GET", `/api/agents/${agent.id}/sessions`, { cookie: user.cookie })

        assert.deepStrictEqual(
          [prepared.json.action, renewed.spec, statuses(sessions.json)],
          ["renew", encode(PICKER), ["replaced", "active"]]
        )
        assert.isTrue(Date.parse(renewed.lockedUntil) >= Date.parse(agent.lockedUntil))
        yield* user.events.close
      }))

    it.effect("409 agentBusy: a draft has nothing to renew", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const created = yield* createAgent(cookie)

        const prepared = yield* call("POST", `/api/agents/${created.json.agent.id}/renew`, {
          cookie,
          body: { requestId: randomUUID() }
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
        const sessions = yield* call("GET", `/api/agents/${agent.id}/sessions`, { cookie: user.cookie })

        assert.deepStrictEqual([listed.json, statuses(sessions.json)], [[], ["revoked"]])
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
