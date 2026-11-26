import { SignatureRejected } from "@bluechip/domain/Errors"
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
    it.effect("48 hours on, the recovery passkey makes it: the new passkey owns the account, the old one is out", () =>
      Effect.gen(function*() {
        const users = yield* TestUsers
        const recoveries = yield* TestRecovery
        const user = yield* users.funded
        const key = yield* recoveries.setUp(user)
        const { newPasskey } = yield* recoveries.request(user, key)
        yield* (yield* TestClocks).moveAhead(48 * 3600 + 60)

        // A recovery sign-in lasts minutes: the one that asked has ended by now.
        const browser = yield* recoveries.signIn(key)
        const signing = yield* browser.api.recovering.execute()
        yield* browser.api.recovering.confirm({
          params: { id: signing.id },
          payload: { credential: key.authenticator.authenticate(signing.options) }
        })
        yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "recoveryCompleted")
        // Completing it signs every device out, the recovery's too: what it left is read from a new sign-in.
        const signIn = Effect.fnUntraced(function*(passkey: typeof newPasskey) {
          const device = yield* users.browser
          const ceremony = yield* device.api.auth.loginOptions()
          const me = yield* device.api.auth.loginVerify({
            payload: { challengeId: ceremony.challengeId, credential: passkey.authenticate(ceremony.options) }
          })
          return { device, me }
        })
        const { device, me } = yield* signIn(newPasskey)
        const recovery = yield* device.api.accountRecovery.get()
        const refused = yield* Effect.flip(signIn(user.authenticator))

        assert.deepStrictEqual(
          [recovery.request?.status, me.user.id, me.account.address, { ...refused }],
          ["completed", user.id, user.account, { ...new SignatureRejected({ reason: "unknownPasskey" }) }]
        )
      }))
  })
})
