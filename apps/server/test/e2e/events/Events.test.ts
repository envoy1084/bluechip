import { Unauthenticated } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("events", (it) => {
  describe("GET /api/events", () => {
    it.effect("200: a signed-in user's stream opens with a heartbeat", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const first = yield* Stream.runHead(yield* api.events.watch())

        assert.deepStrictEqual(Option.map(first, (event) => event._tag), Option.some("Heartbeat"))
      }))

    it.effect("401: no session", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const error = yield* Effect.flip(api.events.watch())

        assert.deepStrictEqual({ ...error }, { ...new Unauthenticated() })
      }))
  })
})
