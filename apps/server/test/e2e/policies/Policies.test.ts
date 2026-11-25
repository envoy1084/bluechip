import { InvalidSpec } from "@bluechip/domain/Errors"
import { AgentSpec, PolicyProblem } from "@bluechip/domain/policies/AgentSpec"
import { PolicyChange, SpecChanges } from "@bluechip/domain/policies/Catalog"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { changed, PICKER } from "../../fixtures/Specs.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("policies", (it) => {
  describe("GET /api/policies", () => {
    it.effect("the catalog, every policy once", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const catalog = yield* api.policies.catalog()

        assert.deepStrictEqual(catalog.map((policy) => policy.id), [
          "trade",
          "tradeSize",
          "fairPrice",
          "stockCap",
          "cashReserve",
          "rebalance",
          "slippageBudget",
          "tradesPerDay",
          "gasBudget",
          "anyCall"
        ])
      }))
  })

  describe("/api/templates", () => {
    it.effect("a new user sees the built-in templates and none saved", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const templates = yield* api.policies.templates()

        assert.deepStrictEqual([templates.builtIn.map((template) => template.id), templates.saved], [
          ["rebalancer", "stockPicker", "weeklyBuyer", "stopLossGuard"],
          []
        ])
      }))

    it.effect("a saved template is listed with its policies, completed", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.policies.saveTemplate({
          payload: {
            name: "My picker",
            basedOn: "stockPicker",
            spec: new AgentSpec({ policies: PICKER.policies.slice(0, 7) })
          }
        })

        const templates = yield* api.policies.templates()

        assert.match(saved.id, /^template_/)
        assert.deepStrictEqual(
          templates.saved.map((template) => [template.name, template.basedOn, template.spec]),
          [["My picker", "stockPicker", PICKER]]
        )
      }))

    it.effect("422 InvalidSpec: a template that can't be locked", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(api.policies.saveTemplate({
          payload: { name: "Broken", basedOn: null, spec: changed(PICKER, { id: "trade", config: { stocks: [] } }) }
        }))

        assert.deepStrictEqual({ ...error }, {
          ...new InvalidSpec({
            problems: [new PolicyProblem({ policy: "trade", field: "stocks", message: "Pick at least one stock." })]
          })
        })
      }))

    it.effect("a deleted template is gone, and deleting it again is a 404", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        const saved = yield* api.policies.saveTemplate({
          payload: { name: "Short-lived", basedOn: null, spec: PICKER }
        })

        yield* api.policies.deleteTemplate({ params: { id: saved.id } })
        const again = yield* Effect.flip(api.policies.deleteTemplate({ params: { id: saved.id } }))
        const templates = yield* api.policies.templates()

        assert.deepStrictEqual([{ ...again }, templates.saved], [{
          _tag: "NotFound",
          resource: "template",
          id: saved.id
        }, []])
      }))
  })

  describe("POST /api/sessions/check", () => {
    it.effect("a draft that can be locked, said as sentences", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const checked = yield* api.policies.check({ payload: { spec: PICKER, before: null } })

        assert.deepStrictEqual([checked.problems, checked.description.can[0], checked.changes], [
          [],
          "Buy and sell NVIDIA and Apple",
          null
        ])
      }))

    it.effect("a change compared with the policies in force", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const checked = yield* api.policies.check({
          payload: {
            spec: changed(PICKER, { id: "trade", config: { dailyBudget: BigInt(100_000_000) } }),
            before: PICKER
          }
        })

        assert.deepStrictEqual(
          checked.changes,
          new SpecChanges({ overall: "tighter", policies: [new PolicyChange({ policy: "trade", change: "tighter" })] })
        )
      }))

    it.effect("a draft with problems", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const checked = yield* api.policies.check({
          payload: { spec: changed(PICKER, { id: "tradesPerDay", config: { count: 49 } }), before: null }
        })

        assert.deepStrictEqual(checked.problems, [
          new PolicyProblem({ policy: "tradesPerDay", field: "count", message: "Pick 1 to 48." })
        ])
      }))
  })
})
