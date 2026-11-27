import * as Effect from "effect/Effect"
import { identify } from "../../../lib/analytics.ts"
import { accountReactivityKey, BluechipApiClient } from "../../../lib/api/client.ts"
import { createPasskey } from "../../../lib/passkey.ts"

/** Creates a passkey (Face ID / Touch ID), then the account it owns, and signs in. */
export const signUpAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(displayName: string | undefined) {
    const client = yield* BluechipApiClient
    const name = displayName === undefined || displayName === "" ? {} : { displayName }
    const ceremony = yield* client.auth.registerOptions({ payload: name })
    const credential = yield* createPasskey(ceremony.options)
    const signedUp = yield* client.auth.registerVerify({
      payload: { challengeId: ceremony.challengeId, credential, ...name }
    })
    identify(signedUp.user.id)
    return signedUp
  }),
  { reactivityKeys: [accountReactivityKey] }
)

export const setEligibilityAtom = BluechipApiClient.mutation("account", "setEligibility")

/** Ends this browser's session: the way out for someone bluechip can't serve. */
export const signOutAtom = BluechipApiClient.mutation("auth", "logout")
