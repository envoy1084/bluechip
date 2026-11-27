import * as Effect from "effect/Effect"
import { identify } from "../lib/analytics.ts"
import { accountReactivityKey, BluechipApiClient, liveReactivityKey } from "../lib/api/client.ts"
import { signWithPasskey } from "../lib/passkey.ts"

/** The signed-in user and their account; fails with `Unauthenticated` when there is no session. */
export const meAtom = BluechipApiClient.query("account", "me", {
  reactivityKeys: [accountReactivityKey, liveReactivityKey]
})

/** Saves the user's time zone (quiet hours and the digest's morning follow it). */
export const setTimeZoneAtom = BluechipApiClient.mutation("account", "setTimeZone")

/**
 * Signs in with any passkey this site knows (the browser offers the user's passkeys): from the landing and welcome
 * pages, and from a session that ended while a page was open.
 */
export const signInAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*() {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.auth.loginOptions()
    const credential = yield* signWithPasskey(ceremony.options)
    const signedIn = yield* client.auth.loginVerify({ payload: { challengeId: ceremony.challengeId, credential } })
    identify(signedIn.user.id)
    return signedIn
  }),
  { reactivityKeys: [accountReactivityKey] }
)
