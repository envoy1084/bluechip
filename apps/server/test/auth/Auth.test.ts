import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { call, origin, signIn, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

const newAuthenticator = () => softwareAuthenticator({ rpId: "localhost", origin })

describe("POST /api/auth/register/verify", () => {
  it.effect("200: a new passkey makes a user, a session and an account not yet deployed", () =>
    Effect.gen(function*() {
      const created = yield* signUp(newAuthenticator())

      assert.strictEqual(created.status, 200)
      assert.match(created.session!, /^.+$/)
      assert.match(created.json.account.address, ADDRESS)
      assert.strictEqual(created.json.user.eligibility, "unknown")
    }))

  it.effect("403: a passkey made for another site", () =>
    Effect.gen(function*() {
      const phishing = softwareAuthenticator({ rpId: "localhost", origin: "https://evil.example" })
      const ceremony = yield* call("POST", "/api/auth/register/options", { body: {} })

      const verified = yield* call("POST", "/api/auth/register/verify", {
        body: { challengeId: ceremony.json.challengeId, credential: phishing.register(ceremony.json.options.challenge) }
      })

      assert.strictEqual(verified.status, 403)
    }))
})

describe("POST /api/auth/login/verify", () => {
  it.effect("200: the passkey signs back in to its account", () =>
    Effect.gen(function*() {
      const authenticator = newAuthenticator()
      const created = yield* signUp(authenticator)

      const { result } = yield* signIn(authenticator)

      assert.strictEqual(result.status, 200)
      assert.strictEqual(result.json.account.address, created.json.account.address)
    }))

  it.effect("403: a passkey bluechip doesn't know", () =>
    Effect.gen(function*() {
      const { result } = yield* signIn(newAuthenticator())

      assert.strictEqual(result.status, 403)
      assert.strictEqual(result.json.reason, "unknownPasskey")
    }))

  it.effect("403: a challenge answered twice", () =>
    Effect.gen(function*() {
      const authenticator = newAuthenticator()
      yield* signUp(authenticator)
      const { body } = yield* signIn(authenticator)

      const replay = yield* call("POST", "/api/auth/login/verify", { body })

      assert.strictEqual(replay.status, 403)
      assert.strictEqual(replay.json.reason, "challenge")
    }))

  it.effect("403: a passkey whose signature counter went backwards (a clone)", () =>
    Effect.gen(function*() {
      const cloned = newAuthenticator()
      yield* signUp(cloned)
      yield* signIn(cloned)
      cloned.rewindCounter()

      const { result } = yield* signIn(cloned)

      assert.strictEqual(result.status, 403)
    }))
})

describe("POST /api/auth/logout", () => {
  it.effect("204: the session ends, and the next request is 401", () =>
    Effect.gen(function*() {
      const created = yield* signUp(newAuthenticator())
      const cookie = `bluechip_session=${created.session}`

      const out = yield* call("POST", "/api/auth/logout", { cookie })

      assert.strictEqual(out.status, 204)
      assert.strictEqual((yield* call("GET", "/api/account", { cookie })).status, 401)
    }))
})
