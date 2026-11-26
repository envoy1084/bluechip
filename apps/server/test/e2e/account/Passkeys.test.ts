import { ownersOf } from "@bluechip/chain/account/Owners"
import { ChainClient } from "@bluechip/chain/ChainClient"
import { Conflict, NotFound, SignatureRejected } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import * as Authenticator from "../../utils/Authenticator.ts"
import { origin } from "../../utils/TestConfig.ts"
import { type TestUser, TestUsers } from "../../utils/TestUsers.ts"

const requestId = () => RequestId.make(randomUUID())

// The server follows operations onchain on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("the account's passkeys", (it) => {
  // A second passkey, added with one Face ID of the first and landed onchain.
  const addSecond = Effect.fnUntraced(function*(user: TestUser) {
    const second = Authenticator.make({ rpId: "localhost", origin })
    const ceremony = yield* user.api.account.passkeyOptions()
    const change = yield* user.api.account.addPasskey({
      payload: {
        requestId: requestId(),
        challengeId: ceremony.challengeId,
        credential: second.register(ceremony.options)
      }
    })
    const sent = yield* user.api.account.confirmPasskeyChange({
      params: { id: change.id },
      payload: { credential: user.authenticator.authenticate(change.options) }
    })
    yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "passkeyAdded")
    return { second, change, sent }
  }, Effect.orDie)

  describe("GET /api/account/passkeys", () => {
    it.effect("the sign-up passkey is the account's one owner", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const passkeys = yield* user.api.account.passkeys()

        assert.deepStrictEqual(
          passkeys.map(({ current, role, status }) => ({ role, status, current })),
          [{ role: "owner", status: "active", current: true }]
        )
      }))
  })

  describe("POST /api/account/passkeys", () => {
    it.effect("a second passkey becomes an owner onchain, with a security notification", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const user = yield* (yield* TestUsers).funded

        const { change, sent } = yield* addSecond(user)
        const passkeys = yield* user.api.account.passkeys()
        const owners = yield* ownersOf(user.account).pipe(Effect.provideService(ChainClient, chain))

        assert.deepStrictEqual([change.action, sent.status], ["add", "pending"])
        assert.deepStrictEqual(passkeys.map((passkey) => passkey.status), ["active", "active"])
        assert.strictEqual(owners.credentialIds.length, 2)
      }))

    it.effect("the second passkey signs in on its own", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.funded
        const { second } = yield* addSecond(user)
        const other = yield* users.browser

        const ceremony = yield* other.api.auth.loginOptions()
        const me = yield* other.api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: second.authenticate(ceremony.options) }
        })

        assert.strictEqual(me.user.id, user.id)
      }))

    it.effect("a passkey already known is refused", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const ceremony = yield* user.api.account.passkeyOptions()

        const error = yield* Effect.flip(user.api.account.addPasskey({
          payload: {
            requestId: requestId(),
            challengeId: ceremony.challengeId,
            credential: user.authenticator.register(ceremony.options)
          }
        }))

        assert.strictEqual(error._tag, "SignatureRejected")
      }))
  })

  describe("POST /api/account/passkeys/:id/remove", () => {
    it.effect("409 lastPasskey: the one owner can't be removed", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const [only] = yield* user.api.account.passkeys()

        const error = yield* Effect.flip(
          user.api.account.removePasskey({ params: { id: only!.id }, payload: { requestId: requestId() } })
        )

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "lastPasskey" }) })
      }))

    it.effect("404: another user's passkey", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const user = yield* users.signUp
        const stranger = yield* users.signUp
        const [theirs] = yield* stranger.api.account.passkeys()

        const error = yield* Effect.flip(
          user.api.account.removePasskey({ params: { id: theirs!.id }, payload: { requestId: requestId() } })
        )

        assert.deepStrictEqual({ ...error }, { ...new NotFound({ resource: "passkey", id: theirs!.id }) })
      }))

    it.effect("a removed passkey leaves the chain's owners and can't sign in again", () =>
      Effect.gen(function*() {
        const chain = yield* ChainClient
        const users = yield* TestUsers
        const user = yield* users.funded
        const { second } = yield* addSecond(user)
        const first = (yield* user.api.account.passkeys()).find((passkey) => passkey.current)!

        const change = yield* user.api.account.removePasskey({
          params: { id: first.id },
          payload: { requestId: requestId() }
        })
        yield* user.api.account.confirmPasskeyChange({
          params: { id: change.id },
          payload: { credential: second.authenticate(change.options) }
        })
        yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "passkeyRemoved")
        const other = yield* users.browser
        const ceremony = yield* other.api.auth.loginOptions()
        const signIn = yield* Effect.flip(other.api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        }))
        const owners = yield* ownersOf(user.account).pipe(Effect.provideService(ChainClient, chain))

        assert.deepStrictEqual({ ...signIn }, { ...new SignatureRejected({ reason: "unknownPasskey" }) })
        assert.strictEqual(owners.credentialIds.length, 1)
        assert.strictEqual((yield* Effect.flip(user.api.account.passkeys()))._tag, "Unauthenticated")
      }))
  })
})
