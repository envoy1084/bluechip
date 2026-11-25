import type { AuthenticationCredential, RegistrationCredential } from "@bluechip/domain/WebAuthn"
import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import * as Effect from "effect/Effect"
import { BluechipApiClient, liveReactivityKey } from "../api/client.ts"

/** Queries about the signed-in user refetch when this key is invalidated (sign-in, sign-out, eligibility). */
export const accountReactivityKey = "account"

/** The signed-in user and their account; fails with `Unauthenticated` when there is no session. */
export const meAtom = BluechipApiClient.query("account", "me", {
  reactivityKeys: [accountReactivityKey, liveReactivityKey]
})

export const passkeysAtom = BluechipApiClient.query("account", "passkeys", { reactivityKeys: [accountReactivityKey] })

// The browser's WebAuthn JSON and the domain schemas describe the same objects (SimpleWebAuthn types its extension
// outputs as an interface, the schema as a record); the server decodes and checks every field.
export const ceremonyOptions = <A>(options: Record<string, unknown>) => options as A
export const asCredential = <A>(credential: object) => credential as unknown as A

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

/** Signs in with any passkey this site knows; the browser offers the user's passkeys. */
export const signInAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.auth.loginOptions()
    const credential = yield* Effect.tryPromise(() =>
      startAuthentication({ optionsJSON: ceremonyOptions(ceremony.options) })
    )
    return yield* client.auth.loginVerify({
      payload: {
        challengeId: ceremony.challengeId,
        credential: asCredential<typeof AuthenticationCredential.Type>(credential)
      }
    })
  }),
  { reactivityKeys: [accountReactivityKey] }
)

export const signOutAtom = BluechipApiClient.mutation("auth", "logout")

export const setEligibilityAtom = BluechipApiClient.mutation("account", "setEligibility")

export const setDisplayNameAtom = BluechipApiClient.mutation("account", "setDisplayName")
