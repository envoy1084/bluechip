import { AutomationProblem } from "@bluechip/domain/automations/Automation"
import { InvalidAutomation, NotFound } from "@bluechip/domain/Errors"
import { AutomationId, RequestId } from "@bluechip/domain/Ids"
import { draftSpec } from "@bluechip/domain/policies/Templates"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { typeid } from "typeid-js"
import { nvidiaStopLoss, weeklyNvidia } from "../../fixtures/Automations.ts"
import { TestAgents } from "../../utils/TestAgents.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

const requestId = () => RequestId.make(randomUUID())

// The server runs on the real clock (see `TestServer`).
layer(TestAgents.layer, { excludeTestServices: true })("automations", (it) => {
  describe("GET /api/automations/catalog", () => {
    it.effect("every trigger, condition and action once", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const catalog = yield* api.automations.catalog()

        assert.deepStrictEqual(catalog.map((entry) => `${entry.kind}:${entry.type}`), [
          "trigger:schedule",
          "trigger:priceMove",
          "trigger:priceCross",
          "trigger:drift",
          "trigger:portfolio",
          "trigger:news",
          "condition:marketOpen",
          "condition:pricesFresh",
          "condition:priceAbove",
          "condition:priceBelow",
          "condition:holdingAtLeast",
          "condition:timeWindow",
          "condition:all",
          "condition:any",
          "condition:not",
          "condition:judgment",
          "action:buy",
          "action:sell",
          "action:sellShare",
          "action:rebalance",
          "action:notify",
          "action:ask"
        ])
      }))
  })

  describe("POST /api/automations/check", () => {
    it.effect("a stop-loss for a Stock picker: no problems, and its sentence", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user))

        const check = yield* user.api.automations.check({ payload: { draft: nvidiaStopLoss(agent.id) } })

        assert.deepStrictEqual([check.problems, check.description.sentence], [
          [],
          "When NVIDIA falls 10% from its high, sell half your NVIDIA."
        ])
      }))

    it.effect("404: an agent that isn't yours", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const someone = yield* users.funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(someone))
        const user = yield* users.signUp

        const error = yield* Effect.flip(user.api.automations.check({ payload: { draft: weeklyNvidia(agent.id) } }))

        assert.deepStrictEqual(error, new NotFound({ resource: "agent", id: agent.id }))
      }))
  })

  describe("POST /api/automations", () => {
    it.effect("a weekly buy of your own is saved active, with its next run", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const saved = yield* api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(null) } })

        assert.match(saved.id, /^automation_/)
        assert.deepStrictEqual(
          [saved.status, saved.fires, saved.createdBy, saved.description.sentence, saved.nextRunAt === null],
          ["active", 0, "owner", "Every Monday at 10:00 New York time, buy $50 of NVIDIA.", false]
        )
      }))

    it.effect("the same request twice saves one automation", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const id = requestId()

        const first = yield* api.automations.create({ payload: { requestId: id, draft: weeklyNvidia(null) } })
        const again = yield* api.automations.create({ payload: { requestId: id, draft: weeklyNvidia(null) } })
        const listed = yield* api.automations.list({ query: {} })

        assert.deepStrictEqual([again.id, listed.map((automation) => automation.id)], [first.id, [first.id]])
      }))

    it.effect("422: a buy for an agent that only sells, with the problem in words", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user, {
          template: "stopLossGuard",
          spec: draftSpec({ template: "stopLossGuard", preset: "balanced", stocks: ["NVDA"], targets: [] })
        }))

        const error = yield* Effect.flip(
          user.api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(agent.id) } })
        )

        assert.deepStrictEqual(
          error,
          new InvalidAutomation({
            problems: [
              new AutomationProblem({ part: "action", index: null, field: null, message: "This agent only sells." })
            ]
          })
        )
      }))
  })

  describe("GET /api/agents/:agentId/automations/defaults", () => {
    it.effect("a Weekly buyer of NVIDIA comes with a weekly buy, saved as the template's", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user, {
          template: "weeklyBuyer",
          spec: draftSpec({ template: "weeklyBuyer", preset: "balanced", stocks: ["NVDA"], targets: [] })
        }))

        const drafts = yield* user.api.automations.defaults({ params: { agentId: agent.id } })
        const saved = yield* user.api.automations.create({
          payload: { requestId: requestId(), draft: drafts[0]!, createdBy: "template" }
        })

        assert.deepStrictEqual(
          [drafts.map((draft) => draft.name), saved.createdBy, saved.agentId, saved.description.sentence],
          [["Weekly buy of NVDA"], "template", agent.id, "Every Monday at 10:00 New York time, buy $100 of NVIDIA."]
        )
      }))

    it.effect("a Stock picker comes with none", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user))

        const drafts = yield* user.api.automations.defaults({ params: { agentId: agent.id } })

        assert.deepStrictEqual(drafts, [])
      }))
  })

  describe("GET /api/automations", () => {
    it.effect("only one agent's, with agentId", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user))
        yield* user.api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(null) } })
        const agents = yield* user.api.automations.create({
          payload: { requestId: requestId(), draft: nvidiaStopLoss(agent.id) }
        })

        const listed = yield* user.api.automations.list({ query: { agentId: agent.id } })

        assert.deepStrictEqual(listed.map((automation) => automation.id), [agents.id])
      }))
  })

  describe("GET /api/automations/:id", () => {
    it.effect("a new automation has no runs yet", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(null) } })

        const detail = yield* api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual([detail.automation.id, detail.runs, detail.judgments], [saved.id, [], []])
      }))

    it.effect("404: someone else's", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const someone = yield* users.signUp
        const saved = yield* someone.api.automations.create({
          payload: { requestId: requestId(), draft: weeklyNvidia(null) }
        })
        const { api } = yield* users.signUp

        const error = yield* Effect.flip(api.automations.automation({ params: { id: saved.id } }))

        assert.deepStrictEqual(error, new NotFound({ resource: "automation", id: saved.id }))
      }))
  })

  describe("PATCH /api/automations/:id", () => {
    it.effect("paused, then resumed", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(null) } })

        const paused = yield* api.automations.update({ params: { id: saved.id }, payload: { status: "paused" } })
        const resumed = yield* api.automations.update({ params: { id: saved.id }, payload: { status: "active" } })

        assert.deepStrictEqual([paused.status, resumed.status], ["paused", "active"])
      }))

    it.effect("edited to an 8% stop-loss: its sentence follows", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.automations.create({
          payload: { requestId: requestId(), draft: nvidiaStopLoss(null) }
        })

        const edited = yield* api.automations.update({
          params: { id: saved.id },
          payload: { draft: nvidiaStopLoss(null, { bps: 800 }) }
        })

        assert.strictEqual(edited.description.sentence, "When NVIDIA falls 8% from its high, sell half your NVIDIA.")
      }))

    it.effect("422: moved to another agent", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const { agent } = yield* Effect.orDie((yield* TestAgents).create(user))
        const saved = yield* user.api.automations.create({
          payload: { requestId: requestId(), draft: nvidiaStopLoss(null) }
        })

        const error = yield* Effect.flip(
          user.api.automations.update({ params: { id: saved.id }, payload: { draft: nvidiaStopLoss(agent.id) } })
        )

        assert.deepStrictEqual(
          error,
          new InvalidAutomation({
            problems: [
              new AutomationProblem({ part: "name", index: null, field: "agentId", message: "Its agent can't change." })
            ]
          })
        )
      }))
  })

  describe("DELETE /api/automations/:id", () => {
    it.effect("deleted: no longer listed or found", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.automations.create({ payload: { requestId: requestId(), draft: weeklyNvidia(null) } })

        yield* api.automations.remove({ params: { id: saved.id } })
        const listed = yield* api.automations.list({ query: {} })
        const error = yield* Effect.flip(api.automations.automation({ params: { id: saved.id } }))

        assert.deepStrictEqual([listed, error], [[], new NotFound({ resource: "automation", id: saved.id })])
      }))

    it.effect("404: one that doesn't exist", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const id = AutomationId.make(typeid("automation").toString())

        const error = yield* Effect.flip(api.automations.remove({ params: { id } }))

        assert.deepStrictEqual(error, new NotFound({ resource: "automation", id }))
      }))
  })
})
