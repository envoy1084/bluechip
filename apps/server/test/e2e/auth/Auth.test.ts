import { SignatureRejected, Unauthenticated } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Ref from "effect/Ref"
import * as Authenticator from "../../utils/Authenticator.ts"
import { origin } from "../../utils/TestConfig.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("auth", (it) => {
  describe("POST /api/auth/register/verify", () => {
    it.effect("200: a new passkey makes a user, a session and an account not yet deployed", () =>
      Effect.gen(function*() {
        const { api, cookies } = yield* (yield* TestUsers).browser
        const authenticator = Authenticator.make({ rpId: "localhost", origin })
        const ceremony = yield* api.auth.registerOptions({ payload: {} })

        const me = yield* api.auth.registerVerify({
          payload: { challengeId: ceremony.challengeId, credential: authenticator.register(ceremony.options) }
        })

        assert.deepStrictEqual((yield* Ref.get(cookies)).map((cookie) => cookie.name), ["bluechip_session"])
        assert.match(me.account.address, /^0x[0-9a-fA-F]{40}$/)
        assert.deepStrictEqual([me.account.deployed, me.user.eligibility], [false, "unknown"])
      }))

    it.effect("403: a passkey made for another site", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser
        const phishing = Authenticator.make({ rpId: "localhost", origin: "https://evil.example" })
        const ceremony = yield* api.auth.registerOptions({ payload: {} })

        const error = yield* Effect.flip(api.auth.registerVerify({
          payload: { challengeId: ceremony.challengeId, credential: phishing.register(ceremony.options) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "invalid" }) })
      }))
  })

  describe("POST /api/auth/login/verify", () => {
    it.effect("200: the passkey signs back in to its account", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const { api } = yield* users.browser
        const ceremony = yield* api.auth.loginOptions()

        const me = yield* api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        })

        assert.strictEqual(me.account.address, user.account)
      }))

    it.effect("403: a passkey bluechip doesn't know", () =>
      Effect.gen(function*() {
        const { api } = yield* (yield* TestUsers).browser
        const stranger = Authenticator.make({ rpId: "localhost", origin })
        const ceremony = yield* api.auth.loginOptions()

        const error = yield* Effect.flip(api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: stranger.authenticate(ceremony.options) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "unknownPasskey" }) })
      }))

    it.effect("403: a challenge answered twice", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const { api } = yield* users.browser
        const ceremony = yield* api.auth.loginOptions()
        const verify = api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        })
        yield* verify

        const error = yield* Effect.flip(verify)

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "challenge" }) })
      }))

    it.effect("403: a passkey whose signature counter went backwards (a clone)", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const { api } = yield* users.browser
        const first = yield* api.auth.loginOptions()
        yield* api.auth.loginVerify({
          payload: { challengeId: first.challengeId, credential: user.authenticator.authenticate(first.options) }
        })
        user.authenticator.rewindCounter()
        const second = yield* api.auth.loginOptions()

        const error = yield* Effect.flip(api.auth.loginVerify({
          payload: { challengeId: second.challengeId, credential: user.authenticator.authenticate(second.options) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "counter" }) })
      }))
  })

  describe("POST /api/auth/logout", () => {
    it.effect("204: the session ends, and the next request with its cookie is 401", () =>
      Effect.gen(function*() {
        const { api, cookies } = yield* (yield* TestUsers).signUp
        const session = yield* Ref.get(cookies)

        yield* api.auth.logout()
        yield* Ref.set(cookies, session)
        const error = yield* Effect.flip(api.account.me())

        assert.deepStrictEqual({ ...error }, { ...new Unauthenticated() })
      }))
  })
})
