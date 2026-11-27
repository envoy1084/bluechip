import { NotFound } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { weeklyBuy } from "../../fixtures/Automations.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("POST /api/dev/automations/:id/fire", (it) => {
  describe("fireAutomation", () => {
    it.effect("204: your Monday buy runs now and asks you about its trade", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })

        yield* user.api.dev.fireAutomation({ params: { id: saved.id } })
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual(
          detail.runs.map((run) => [run.trigger.summary, run.outcome, run.intentIds.length]),
          [["It was run by hand.", "asked", 1]]
        )
      }))

    it.effect("204: fired twice, each fire is a run of its own", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })

        yield* user.api.dev.fireAutomation({ params: { id: saved.id } })
        yield* user.api.dev.fireAutomation({ params: { id: saved.id } })
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.strictEqual(detail.runs.length, 2)
      }))

    it.effect("404: another person's automation", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const owner = yield* users.signUp
        const other = yield* users.signUp
        const saved = yield* owner.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })

        const error = yield* Effect.flip(other.api.dev.fireAutomation({ params: { id: saved.id } }))
        const detail = yield* owner.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual([error instanceof NotFound, detail.runs], [true, []])
      }))

    it.effect("404: an automation you deleted", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const saved = yield* user.api.automations.create({
          payload: { requestId: RequestId.make(randomUUID()), draft: weeklyBuy(null) }
        })
        yield* user.api.automations.remove({ params: { id: saved.id } })

        const error = yield* Effect.flip(user.api.dev.fireAutomation({ params: { id: saved.id } }))

        assert.instanceOf(error, NotFound)
      }))
  })
})
