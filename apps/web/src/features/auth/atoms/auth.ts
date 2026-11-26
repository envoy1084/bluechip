import type { RegistrationCredential } from "@bluechip/domain/WebAuthn"
import { startRegistration } from "@simplewebauthn/browser"
import * as Effect from "effect/Effect"
import { accountReactivityKey, BluechipApiClient } from "../../../lib/api/client.ts"
import { asCredential, ceremonyOptions } from "../../../lib/passkey.ts"

/** Creates a passkey (Face ID / Touch ID), then the account it owns, and signs in. */
export const signUpAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(displayName: string | undefined) {
    const client = yield* BluechipApiClient
    const name = displayName === undefined || displayName === "" ? {} : { displayName }
    const ceremony = yield* client.auth.registerOptions({ payload: name })
    const credential = yield* Effect.tryPromise(() =>
      startRegistration({ optionsJSON: ceremonyOptions(ceremony.options) })
    )
    return yield* client.auth.registerVerify({
      payload: {
        challengeId: ceremony.challengeId,
        credential: asCredential<typeof RegistrationCredential.Type>(credential),
        ...name
      }
    })
  }),
  { reactivityKeys: [accountReactivityKey] }
)

export const setEligibilityAtom = BluechipApiClient.mutation("account", "setEligibility")

/** Ends this browser's session: the way out for someone bluechip can't serve. */
export const signOutAtom = BluechipApiClient.mutation("auth", "logout")
