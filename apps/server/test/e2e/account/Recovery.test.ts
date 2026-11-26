import { Conflict, SignatureRejected } from "@bluechip/domain/Errors"
import { RequestId } from "@bluechip/domain/Ids"
import { assert, describe, layer } from "@effect/vitest"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import * as Authenticator from "../../utils/Authenticator.ts"
import { origin } from "../../utils/TestConfig.ts"
import { TestRecovery } from "../../utils/TestRecovery.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// The server follows operations onchain on the real clock (see `TestServer`).
layer(TestRecovery.layer, { excludeTestServices: true })("account recovery", (it) => {
  describe("POST /api/account/recovery/key", () => {
    it.effect("a recovery passkey set up with one Face ID is ready, with a security notification", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded

        yield* (yield* TestRecovery).setUp(user)
        const recovery = yield* user.api.accountRecovery.get()

        assert.deepStrictEqual([recovery.key?.status, recovery.request], ["active", null])
      }))

    it.effect("409 recoveryKeyExists: a second recovery passkey", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        yield* (yield* TestRecovery).setUp(user)
        const ceremony = yield* user.api.accountRecovery.keyOptions()

        const error = yield* Effect.flip(user.api.accountRecovery.setUp({
          payload: {
            requestId: RequestId.make(randomUUID()),
            challengeId: ceremony.challengeId,
            credential: Authenticator.make({ rpId: "localhost", origin }).register(ceremony.options)
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "recoveryKeyExists" }) })
      }))
  })

  describe("POST /api/recovery/sign-in", () => {
    it.effect("the recovery passkey signs in to the recovery only, with nothing under way", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        const key = yield* recoveries.setUp(user)

        const browser = yield* recoveries.signIn(key)
        const recovering = yield* browser.api.recovering.get()
        const account = yield* Effect.flip(browser.api.account.me())

        assert.deepStrictEqual([recovering.account, recovering.request], [user.account, null])
        assert.strictEqual(account._tag, "Unauthenticated")
      }))

    it.effect("the recovery passkey can't sign in to the account", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        const key = yield* (yield* TestRecovery).setUp(user)
        const browser = yield* (yield* TestUsers).browser

        const ceremony = yield* browser.api.auth.loginOptions()
        const error = yield* Effect.flip(browser.api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: key.authenticator.authenticate(ceremony.options) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "unknownPasskey" }) })
      }))

    it.effect("an owner passkey can't sign in to a recovery", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const browser = yield* (yield* TestUsers).browser

        const ceremony = yield* browser.api.recovery.options()
        const error = yield* Effect.flip(browser.api.recovery.signIn({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        }))

        assert.deepStrictEqual({ ...error }, { ...new SignatureRejected({ reason: "unknownPasskey" }) })
      }))
  })

  describe("POST /api/recovery/request", () => {
    it.effect("asked for onchain, it waits 48 hours and the owner is told", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        const key = yield* recoveries.setUp(user)

        const { recovering } = yield* recoveries.request(user, key)
        const request = recovering.request!
        const wait = DateTime.toEpochMillis(request.executableAt!) - DateTime.toEpochMillis(request.requestedAt)
        const owner = yield* user.api.accountRecovery.get()

        assert.strictEqual(request.status, "waiting")
        assert.isTrue(Math.abs(wait - 48 * 3600 * 1000) < 60_000)
        assert.deepStrictEqual(owner.request, request)
      }))

    it.effect("409 recoveryNotDue: making it before 48 hours", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        const { browser } = yield* recoveries.request(user, yield* recoveries.setUp(user))

        const error = yield* Effect.flip(browser.api.recovering.execute())

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "recoveryNotDue" }) })
      }))

    it.effect("409 recoveryPending: asking again while one waits", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        const { browser } = yield* recoveries.request(user, yield* recoveries.setUp(user))
        const ceremony = yield* browser.api.recovering.passkeyOptions()

        const error = yield* Effect.flip(browser.api.recovering.request({
          payload: {
            challengeId: ceremony.challengeId,
            credential: Authenticator.make({ rpId: "localhost", origin }).register(ceremony.options)
          }
        }))

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "recoveryPending" }) })
      }))
  })

  describe("POST /api/account/recovery/cancel", () => {
    it.effect("a signed-in device cancels the recovery onchain without Face ID", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        const { browser } = yield* recoveries.request(user, yield* recoveries.setUp(user))

        const recovery = yield* user.api.accountRecovery.cancel()
        const { notification } = yield* user.events.next(
          "NotificationAdded",
          ({ notification }) => notification.kind === "recoveryCancelled"
        )
        const execute = yield* Effect.flip(browser.api.recovering.execute())

        assert.deepStrictEqual([recovery.request?.status, recovery.request?.cancelledFrom], ["cancelled", "app"])
        assert.strictEqual(notification.title, "The recovery was cancelled")
        assert.deepStrictEqual({ ...execute }, { ...new Conflict({ reason: "noRecoveryRequest" }) })
      }))

    it.effect("409 noRecoveryRequest: nothing to cancel", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp

        const error = yield* Effect.flip(user.api.accountRecovery.cancel())

        assert.deepStrictEqual({ ...error }, { ...new Conflict({ reason: "noRecoveryRequest" }) })
      }))
  })

  describe("POST /api/account/recovery/key/remove", () => {
    it.effect("removing the recovery passkey ends a recovery under way", () =>
      Effect.gen(function*() {
        const recoveries = yield* TestRecovery
        const user = yield* (yield* TestUsers).funded
        yield* recoveries.request(user, yield* recoveries.setUp(user))

        const change = yield* user.api.accountRecovery.removeKey({
          payload: { requestId: RequestId.make(randomUUID()) }
        })
        yield* user.api.accountRecovery.confirmKey({
          params: { id: change.id },
          payload: { credential: user.authenticator.authenticate(change.options) }
        })
        yield* user.events.next(
          "NotificationAdded",
          ({ notification }) => notification.kind === "recoveryKeyChanged" && notification.title.includes("removed")
        )
        const recovery = yield* user.api.accountRecovery.get()

        assert.deepStrictEqual([recovery.key, recovery.request?.status], [null, "cancelled"])
      }))
  })
})
