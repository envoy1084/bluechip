import { Agent, AgentRequest } from "@bluechip/domain/agents/Agent"
import { Conflict, InvalidSpec, NotFound, SignatureRejected } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { AgentSpec, PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { changed, PICKER } from "../../fixtures/Specs.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("agents", (it) => {
  describe("POST /api/agents", () => {
    it.effect("a Stock picker from its template is created as a draft, with its lock prepared for the passkey", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded

        const created = yield* (yield* TestAgents).create(user)

        assert.deepStrictEqual(
          {
            action: created.action,
            status: created.agent.status,
            template: created.agent.template,
            spec: created.agent.spec,
            pendingSpec: created.agent.pendingSpec
          },
          { action: "lock", status: "draft", template: "stockPicker", spec: PICKER, pendingSpec: null }
        )
      }))

    it.effect("an agent built from scratch, without bluechip's hidden policies: they are added", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const required = ["trade", "tradeSize", "fairPrice", "tradesPerDay"]

        const created = yield* (yield* TestAgents).create(user, {
          template: null,
          spec: new AgentSpec({ policies: PICKER.policies.filter((entry) => required.includes(entry.id)) })
        })

        assert.deepStrictEqual(created.agent.spec.policies.map((entry) => entry.id), [
          "trade",
          "tradeSize",
          "fairPrice",
          "tradesPerDay",
          "gasBudget",
          "anyCall"
        ])
      }))

    it.effect("422 InvalidSpec: the largest trade over the daily budget", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded

        const error = yield* Effect.flip((yield* TestAgents).create(user, {
          spec: changed(PICKER, { id: "tradeSize", config: { maxPerTrade: BigInt(300_000_000) } })
        }))

        assert.deepStrictEqual({ ...error }, {
          ...new InvalidSpec({
            problems: [
              new PolicyProblem({
                policy: "tradeSize",
                field: "maxPerTrade",
                message: "Can't be more than the daily budget ($250)."
              })
            ]
          })
        })
      }))

    it.effect("404: a saved template that isn't the user's", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const template = typeid("template").toString()

        const error = yield* Effect.flip((yield* TestAgents).create(user, { template }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "template", id: template }) })
      }))

    it.effect("404: a template id that isn't one", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded

        const error = yield* Effect.flip(
          (yield* TestAgents).create(user, { template: "template_01jd0000000000000000000000" })
        )

        assert.deepStrictEqual({ ...error }, {
          ...new NotFound({ resource: "template", id: "template_01jd0000000000000000000000" })
        })
      }))

    it.effect("the same request id twice prepares one agent", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const user = yield* (yield* TestUsers).funded
        const requestId = RequestId.make(randomUUID())

        const first = yield* agents.create(user, { requestId })
        const second = yield* agents.create(user, { requestId })

        assert.deepStrictEqual([second.id, second.agent.id], [first.id, first.agent.id])
      }))
  })

  describe("POST /api/agents/requests/:id/confirm", () => {
    it.effect("a signed lock enables the agent's session: active, locked for 90 days, its first session", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const user = yield* (yield* TestUsers).funded
        const created = yield* agents.create(user)

        const { agent, sent } = yield* agents.sign(user, created, "active")
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })

        assert.strictEqual(sent.status, "locking")
        const days = (DateTime.toEpochMillis(agent.lockedUntil!) - Date.now()) / 86_400_000
        assert.isTrue(days > 89.9 && days <= 90)
        assert.deepStrictEqual(sessions.map((session) => session.status), ["active"])
      }))

    it.effect("403: the same signature confirmed twice", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)
        const confirm = user.api.agents.confirm({
          params: { id: created.id },
          payload: { credential: user.authenticator.authenticate(created.options) }
        })
        yield* confirm

        const error = yield* Effect.flip(confirm)

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "challenge" }) })
      }))
  })

  describe("POST /api/agents/:id/sessions", () => {
    it.effect("a signed change locks the new policies, and the old session is kept as replaced", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const tighter = changed(PICKER, { id: "trade", config: { dailyBudget: BigInt(100_000_000) } })
        const prepared = yield* user.api.agents.change({
          params: { id: agent.id },
          payload: { requestId: RequestId.make(randomUUID()), spec: tighter }
        })

        const { agent: after, sent } = yield* agents.sign(user, prepared, "active")
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })

        assert.deepStrictEqual([sent.status, after.spec, after.lockedUntil], ["updating", tighter, agent.lockedUntil])
        assert.deepStrictEqual(sessions.map((session) => session.status), ["replaced", "active"])
      }))

    it.effect("a change prepared and never signed stays out of the history", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked
        yield* user.api.agents.change({
          params: { id: agent.id },
          payload: {
            requestId: RequestId.make(randomUUID()),
            spec: changed(PICKER, { id: "stockCap", config: { maxBps: 2000 } })
          }
        })

        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })

        assert.deepStrictEqual(sessions.map((session) => session.status), ["active"])
      }))

    it.effect("422 InvalidSpec: a change without a trade policy", () =>
      Effect.gen(function*() {
        const { agent, user } = yield* (yield* TestAgents).locked

        const error = yield* Effect.flip(user.api.agents.change({
          params: { id: agent.id },
          payload: {
            requestId: RequestId.make(randomUUID()),
            spec: new AgentSpec({ policies: PICKER.policies.slice(1) })
          }
        }))

        assert.deepStrictEqual({ ...error }, {
          ...new InvalidSpec({
            problems: [new PolicyProblem({ policy: "trade", field: null, message: "Every agent needs this." })]
          })
        })
      }))

    it.effect("409 agentBusy: a draft has no lock to change", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)

        const error = yield* Effect.flip(user.api.agents.change({
          params: { id: created.agent.id },
          payload: { requestId: RequestId.make(randomUUID()), spec: PICKER }
        }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "agentBusy" }) })
      }))
  })

  describe("POST /api/agents/:id/renew", () => {
    it.effect("a signed renewal locks the same policies with a new key for another 90 days", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const prepared = yield* user.api.agents.renew({
          params: { id: agent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })

        const { agent: renewed } = yield* agents.sign(user, prepared, "active")
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })

        assert.deepStrictEqual(
          [prepared.action, renewed.spec, sessions.map((session) => session.status)],
          ["renew", PICKER, ["replaced", "active"]]
        )
        assert.isTrue(DateTime.isGreaterThanOrEqualTo(renewed.lockedUntil!, agent.lockedUntil!))
      }))

    it.effect("409 agentBusy: a draft has nothing to renew", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)

        const error = yield* Effect.flip(user.api.agents.renew({
          params: { id: created.agent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "agentBusy" }) })
      }))
  })

  describe("POST /api/agents/:id/remove", () => {
    it.effect("a draft is removed at once, with nothing to sign", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const created = yield* (yield* TestAgents).create(user)

        const removed = yield* user.api.agents.remove({
          params: { id: created.agent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })

        assert.instanceOf(removed, Agent)
        assert.strictEqual(removed.status, "removed")
      }))

    it.effect("a signed removal revokes the session: removed, and gone from the list", () =>
      Effect.gen(function*() {
        const agents = yield* TestAgents
        const { agent, user } = yield* agents.locked
        const prepared = yield* user.api.agents.remove({
          params: { id: agent.id },
          payload: { requestId: RequestId.make(randomUUID()) }
        })

        assert.instanceOf(prepared, AgentRequest)
        yield* agents.sign(user, prepared, "removed")
        const listed = yield* user.api.agents.list()
        const sessions = yield* user.api.agents.sessions({ params: { id: agent.id } })

        assert.deepStrictEqual([listed, sessions.map((session) => session.status)], [[], ["revoked"]])
      }))
  })

  describe("GET /api/agents/:id", () => {
    it.effect("404: another user's agent", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const owner = yield* users.funded
        const created = yield* (yield* TestAgents).create(owner)
        const stranger = yield* users.signUp

        const error = yield* Effect.flip(stranger.api.agents.agent({ params: { id: created.agent.id } }))

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "agent", id: created.agent.id }) })
      }))
  })
})
