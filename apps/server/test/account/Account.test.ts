import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { call, origin, signUp } from "../support/api.ts"
import { softwareAuthenticator } from "../support/authenticator.ts"

const newUser = Effect.gen(function*() {
  const created = yield* signUp(softwareAuthenticator({ rpId: "localhost", origin }))
  return { created, cookie: `bluechip_session=${created.session}` }
})

describe("GET /api/account", () => {
  it.effect("200: the user and their account, not yet deployed", () =>
    Effect.gen(function*() {
      const { cookie, created } = yield* newUser

      const me = yield* call("GET", "/api/account", { cookie })

      assert.strictEqual(me.status, 200)
      assert.strictEqual(me.json.account.address, created.json.account.address)
      assert.isFalse(me.json.account.deployed)
    }))

  it.effect("401: no session", () =>
    Effect.gen(function*() {
      assert.strictEqual((yield* call("GET", "/api/account")).status, 401)
    }))

  it.effect("401: a forged session", () =>
    Effect.gen(function*() {
      assert.strictEqual((yield* call("GET", "/api/account", { cookie: "bluechip_session=forged" })).status, 401)
    }))
})

describe("POST /api/account/eligibility", () => {
  it.effect("200: the answer is saved for the next session too", () =>
    Effect.gen(function*() {
      const { cookie } = yield* newUser

      const eligible = yield* call("POST", "/api/account/eligibility", { cookie, body: { answer: "outsideUs" } })

      assert.strictEqual(eligible.json.eligibility, "outsideUs")
      assert.strictEqual((yield* call("GET", "/api/account", { cookie })).json.user.eligibility, "outsideUs")
    }))
})

describe("POST /api/account/display-name", () => {
  it.effect("200: a name, trimmed", () =>
    Effect.gen(function*() {
      const { cookie } = yield* newUser

      const named = yield* call("POST", "/api/account/display-name", { cookie, body: { displayName: "  Grace " } })

      assert.strictEqual(named.json.displayName, "Grace")
    }))

  it.effect("200: an empty name clears it", () =>
    Effect.gen(function*() {
      const { cookie } = yield* newUser
      yield* call("POST", "/api/account/display-name", { cookie, body: { displayName: "Grace" } })

      const cleared = yield* call("POST", "/api/account/display-name", { cookie, body: { displayName: "" } })

      assert.isNull(cleared.json.displayName)
    }))
})

describe("GET /api/account/passkeys", () => {
  it.effect("200: the one passkey, marked as this device's", () =>
    Effect.gen(function*() {
      const { cookie } = yield* newUser

      const passkeys = yield* call("GET", "/api/account/passkeys", { cookie })

      assert.deepStrictEqual(
        passkeys.json.map((passkey: { label: string; current: boolean }) => [passkey.label, passkey.current]),
        [["Passkey", true]]
      )
    }))
})

describe("GET /api/events", () => {
  it.effect("200: a signed-in user's stream opens", () =>
    Effect.gen(function*() {
      const { cookie } = yield* newUser

      const events = yield* call("GET", "/api/events", { cookie })

      assert.strictEqual(events.status, 200)
      yield* Effect.promise(() => events.response.body!.cancel())
    }))

  it.effect("401: no session", () =>
    Effect.gen(function*() {
      assert.strictEqual((yield* call("GET", "/api/events")).status, 401)
    }))
})
