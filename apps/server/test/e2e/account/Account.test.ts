import { Unauthenticated } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Cookies from "effect/http/Cookies"
import * as Ref from "effect/Ref"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("account", (it) => {
  describe("GET /api/account", () => {
    it.effect("200: the user and their account, not yet deployed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const me = yield* user.api.account.me()

        assert.deepStrictEqual([me.account.address, me.account.deployed], [user.account, false])
      }))

    it.effect("401: no session", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser

        const error = yield* Effect.flip(api.account.me())

        assert.deepStrictEqual({ ...error }, { ...new Unauthenticated() })
      }))

    it.effect("401: a forged session", () =>
      Effect.gen(function*() {
        const { api, cookies } = yield* (yield* TestUsers).signUp
        yield* Ref.update(cookies, (jar) =>
          jar.map((cookie) => Cookies.makeCookieUnsafe(cookie.name, "forged", cookie.options)))

        const error = yield* Effect.flip(api.account.me())

        assert.deepStrictEqual({ ...error }, { ...new Unauthenticated() })
      }))
  })

  describe("POST /api/account/eligibility", () => {
    it.effect("200: the answer is saved for the next session too", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const user = yield* api.account.setEligibility({ payload: { answer: "outsideUs" } })
        const me = yield* api.account.me()

        assert.deepStrictEqual([user.eligibility, me.user.eligibility], ["outsideUs", "outsideUs"])
      }))
  })

  describe("POST /api/account/display-name", () => {
    it.effect("200: a name, trimmed", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const user = yield* api.account.setDisplayName({ payload: { displayName: "  Grace " } })

        assert.strictEqual(user.displayName, "Grace")
      }))

    it.effect("200: an empty name clears it", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp
        yield* api.account.setDisplayName({ payload: { displayName: "Grace" } })

        const user = yield* api.account.setDisplayName({ payload: { displayName: "" } })

        assert.isNull(user.displayName)
      }))
  })

  describe("GET /api/account/passkeys", () => {
    it.effect("200: the one passkey, marked as this device's", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).signUp

        const passkeys = yield* api.account.passkeys()

        assert.deepStrictEqual(passkeys.map((passkey) => [passkey.label, passkey.current]), [["Passkey", true]])
      }))
  })
})
