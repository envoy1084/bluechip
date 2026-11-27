import * as Effect from "effect/Effect"
import { BluechipApiClient } from "../../../lib/api/client.ts"
import { createPasskey, signWithPasskey } from "../../../lib/passkey.ts"

/** Signs in with the recovery passkey: the session it starts can only see and make a recovery. */
export const recoverySignInAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.recovery.options()
    const credential = yield* signWithPasskey(ceremony.options)
    return yield* client.recovery.signIn({ payload: { challengeId: ceremony.challengeId, credential } })
  })
)

/** The recovery as it stands, for the person signed in with the recovery passkey. */
export const recoveringAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    return yield* client.recovering.get()
  })
)

/** Makes this device's new passkey, then the recovery passkey signs the request (two prompts). */
export const requestRecoveryAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.recovering.passkeyOptions()
    const credential = yield* createPasskey(ceremony.options)
    const signing = yield* client.recovering.request({ payload: { challengeId: ceremony.challengeId, credential } })
    return yield* client.recovering.confirm({
      params: { id: signing.id },
      payload: { credential: yield* signWithPasskey(signing.options) }
    })
  })
)

/** Once due, the recovery passkey signs the recovery itself. */
export const executeRecoveryAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const signing = yield* client.recovering.execute()
    return yield* client.recovering.confirm({
      params: { id: signing.id },
      payload: { credential: yield* signWithPasskey(signing.options) }
    })
  })
)

/** Once the recovery this device made landed, signs it in with its new passkey (no prompt: the server knows it). */
export const signInRecoveredAtom = BluechipApiClient.mutation("recovering", "signInRecovered")
