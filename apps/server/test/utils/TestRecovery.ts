// Recovery as people make it through the API: the owner sets up a recovery passkey, then someone holding it signs in
// on a new device and asks for the recovery.
import { RequestId } from "@bluechip/domain/Ids"
import type { Recovering } from "@bluechip/domain/recovery/Recovery"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { randomUUID } from "node:crypto"
import * as Authenticator from "./Authenticator.ts"
import { origin } from "./TestConfig.ts"
import { type Browser, type TestUser, TestUsers } from "./TestUsers.ts"

/** A recovery passkey set up on a user's account. */
interface RecoveryKey {
  readonly authenticator: Authenticator.Authenticator
}

/** A new device signed in with the recovery passkey, and the passkey it made, once the recovery was asked for. */
interface Recovery {
  readonly browser: Browser
  readonly newPasskey: Authenticator.Authenticator
  readonly recovering: Recovering
}

export class TestRecovery extends Context.Service<TestRecovery, {
  /** Sets up a recovery passkey on `user`'s (funded) account with their Face ID, and waits until it is locked. */
  readonly setUp: (user: TestUser) => Effect.Effect<RecoveryKey>
  /** A new browser signed in with the recovery passkey. */
  readonly signIn: (key: RecoveryKey) => Effect.Effect<Browser>
  /** Signs in with the recovery passkey, makes a new passkey and asks for the recovery; waits until it is onchain. */
  readonly request: (user: TestUser, key: RecoveryKey) => Effect.Effect<Recovery>
}>()("@bluechip/server/test/TestRecovery") {
  static readonly layerNoDeps = Layer.effect(
    TestRecovery,
    Effect.gen(function*() {
      const users = yield* TestUsers

      const setUp = Effect.fnUntraced(function*(user: TestUser) {
        const authenticator = Authenticator.make({ rpId: "localhost", origin })
        const ceremony = yield* user.api.accountRecovery.keyOptions()
        const change = yield* user.api.accountRecovery.setUp({
          payload: {
            requestId: RequestId.make(randomUUID()),
            challengeId: ceremony.challengeId,
            credential: authenticator.register(ceremony.options)
          }
        })
        yield* user.api.accountRecovery.confirmKey({
          params: { id: change.id },
          payload: { credential: user.authenticator.authenticate(change.options) }
        })
        yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "recoveryKeyChanged")
        return { authenticator }
      }, Effect.orDie)

      const signIn = Effect.fnUntraced(function*(key: RecoveryKey) {
        const browser = yield* users.browser
        const ceremony = yield* browser.api.recovery.options()
        yield* browser.api.recovery.signIn({
          payload: { challengeId: ceremony.challengeId, credential: key.authenticator.authenticate(ceremony.options) }
        })
        return browser
      }, Effect.orDie)

      const request = Effect.fnUntraced(function*(user: TestUser, key: RecoveryKey) {
        const browser = yield* signIn(key)
        const newPasskey = Authenticator.make({ rpId: "localhost", origin })
        const ceremony = yield* browser.api.recovering.passkeyOptions()
        const signing = yield* browser.api.recovering.request({
          payload: { challengeId: ceremony.challengeId, credential: newPasskey.register(ceremony.options) }
        })
        yield* browser.api.recovering.confirm({
          params: { id: signing.id },
          payload: { credential: key.authenticator.authenticate(signing.options) }
        })
        yield* user.events.next("NotificationAdded", ({ notification }) => notification.kind === "recoveryRequested")
        return { browser, newPasskey, recovering: yield* browser.api.recovering.get() }
      }, Effect.orDie)

      return { setUp, signIn, request }
    })
  )

  /** Recovery for the test server's users, served by this layer too. */
  static readonly layer = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layer))

  /** Recovery on a test server with a devnet of the file's own, whose clocks can move ahead (`TestClocks`). */
  static readonly layerIsolated = this.layerNoDeps.pipe(Layer.provideMerge(TestUsers.layerIsolated))
}
