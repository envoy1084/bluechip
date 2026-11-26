import { Conflict, SignatureRejected } from "@bluechip/domain/Errors"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { TestClocks } from "../../utils/TestClocks.ts"
import { TestRecovery } from "../../utils/TestRecovery.ts"
import { TestUsers } from "../../utils/TestUsers.ts"

// A recovery is due 48 hours after it is asked for, by the chain's clock (RecoveryDelayPolicy), the bundler's (Alto
// refuses an operation before its validAfter) and the server's. These tests move all three ahead together, so they
// run on a devnet of their own: on the worker's shared one a moved clock would stay moved.
// The server follows operations onchain on the real clock, moved ahead (see `TestServer`).
layer(TestRecovery.layerIsolated, { excludeTestServices: true })("a due recovery", (it) => {
  describe("POST /api/recovery/execute", () => {
    it.effect("48 hours on, the recovery passkey makes it: this device is signed in with its new passkey, the old one is out", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const recoveries = yield* TestRecovery
        const user = yield* users.funded
        const key = yield* recoveries.setUp(user)
        yield* recoveries.request(user, key)
        yield* (yield* TestClocks).moveAhead(48 * 3600 + 60)

        // A recovery sign-in lasts minutes: the one that asked has ended by now.
        const browser = yield* recoveries.signIn(key)
        const signing = yield* browser.api.recovering.execute()
        yield* browser.api.recovering.confirm({
          params: { id: signing.id },
          payload: { credential: key.authenticator.authenticate(signing.options) }
        })
        yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "recoveryCompleted")
        // The device that made it is signed in with its new passkey; another recovery sign-in is not.
        const other = yield* recoveries.signIn(key)
        const refusedOther = yield* Effect.flip(other.api.recovering.signInRecovered())
        const me = yield* browser.api.recovering.signInRecovered()
        const recovery = yield* browser.api.accountRecovery.get()
        const ended = yield* Effect.flip(browser.api.recovering.get())
        const oldDevice = yield* Effect.flip(user.api.account.me())
        const device = yield* users.browser
        const ceremony = yield* device.api.auth.loginOptions()
        const refused = yield* Effect.flip(device.api.auth.loginVerify({
          payload: { challengeId: ceremony.challengeId, credential: user.authenticator.authenticate(ceremony.options) }
        }))

        assert.deepStrictEqual(
          [
            { ...refusedOther },
            recovery.request?.status,
            me.user.id,
            me.account.address,
            ended._tag,
            oldDevice._tag,
            { ...refused }
          ],
          [
            { ...new Conflict({ reason: "noRecoveryRequest" }) },
            "completed",
            user.id,
            user.account,
            "Unauthenticated",
            "Unauthenticated",
            { ...new SignatureRejected({ reason: "unknownPasskey" }) }
          ]
        )
      }))
  })
})
