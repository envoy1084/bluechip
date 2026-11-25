import * as DevnetTest from "@bluechip/devnet/DevnetTest"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { changed, encode, newCookie, PICKER } from "../support/agents.ts"
import { call } from "../support/api.ts"

layer(DevnetTest.layer)("policies", (it) => {
  describe("GET /api/policies", () => {
    it.effect("the catalog, every policy once", () =>
      Effect.gen(function*() {
        const catalog = yield* call("GET", "/api/policies", { cookie: yield* newCookie })

        assert.deepStrictEqual(catalog.json.map((policy: { id: string }) => policy.id), [
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
        const templates = yield* call("GET", "/api/templates", { cookie: yield* newCookie })

        assert.deepStrictEqual(
          [templates.json.builtIn.map((template: { id: string }) => template.id), templates.json.saved],
          [["rebalancer", "stockPicker", "weeklyBuyer", "stopLossGuard"], []]
        )
      }))

    it.effect("a saved template is listed with its policies, completed", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const saved = yield* call("POST", "/api/templates", {
          cookie,
          body: { name: "My picker", basedOn: "stockPicker", spec: { policies: encode(PICKER).policies.slice(0, 7) } }
        })

        const templates = yield* call("GET", "/api/templates", { cookie })

        assert.match(saved.json.id, /^template_/)
        assert.deepStrictEqual(
          templates.json.saved.map((template: { name: string; basedOn: string; spec: unknown }) => [
            template.name,
            template.basedOn,
            template.spec
          ]),
          [["My picker", "stockPicker", encode(PICKER)]]
        )
      }))

    it.effect("422 InvalidSpec: a template that can't be locked", () =>
      Effect.gen(function*() {
        const saved = yield* call("POST", "/api/templates", {
          cookie: yield* newCookie,
          body: {
            name: "Broken",
            basedOn: null,
            spec: encode(changed(PICKER, { id: "trade", config: { stocks: [] } }))
          }
        })

        assert.deepStrictEqual([saved.status, saved.json.problems[0].message], [422, "Pick at least one stock."])
      }))

    it.effect("a deleted template is gone, and deleting it again is a 404", () =>
      Effect.gen(function*() {
        const cookie = yield* newCookie
        const saved = yield* call("POST", "/api/templates", {
          cookie,
          body: { name: "Short-lived", basedOn: null, spec: encode(PICKER) }
        })

        const deleted = yield* call("DELETE", `/api/templates/${saved.json.id}`, { cookie })
        const again = yield* call("DELETE", `/api/templates/${saved.json.id}`, { cookie })
        const templates = yield* call("GET", "/api/templates", { cookie })

        assert.deepStrictEqual([deleted.status, again.status, templates.json.saved], [200, 404, []])
      }))
  })

  describe("POST /api/sessions/check", () => {
    it.effect("a draft that can be locked, said as sentences", () =>
      Effect.gen(function*() {
        const checked = yield* call("POST", "/api/sessions/check", {
          cookie: yield* newCookie,
          body: { spec: encode(PICKER), before: null }
        })

        assert.deepStrictEqual(
          [checked.json.problems, checked.json.description.can[0], checked.json.changes],
          [[], "Buy and sell NVIDIA and Apple", null]
        )
      }))

    it.effect("a change compared with the policies in force", () =>
      Effect.gen(function*() {
        const checked = yield* call("POST", "/api/sessions/check", {
          cookie: yield* newCookie,
          body: {
            spec: encode(changed(PICKER, { id: "trade", config: { dailyBudget: BigInt(100_000_000) } })),
            before: encode(PICKER)
          }
        })

        assert.deepStrictEqual(checked.json.changes, {
          overall: "tighter",
          policies: [{ policy: "trade", change: "tighter" }]
        })
      }))

    it.effect("a draft with problems", () =>
      Effect.gen(function*() {
        const checked = yield* call("POST", "/api/sessions/check", {
          cookie: yield* newCookie,
          body: { spec: encode(changed(PICKER, { id: "tradesPerDay", config: { count: 49 } })), before: null }
        })

        assert.deepStrictEqual(checked.json.problems, [{
          policy: "tradesPerDay",
          field: "count",
          message: "Pick 1 to 48."
        }])
      }))
  })
})
