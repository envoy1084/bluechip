import { accountReactivityKey, BluechipApiClient, liveReactivityKey } from "../lib/api/client.ts"

/** The signed-in user and their account; fails with `Unauthenticated` when there is no session. */
export const meAtom = BluechipApiClient.query("account", "me", {
  reactivityKeys: [accountReactivityKey, liveReactivityKey]
})

/** Saves the user's time zone (quiet hours and the digest's morning follow it). */
export const setTimeZoneAtom = BluechipApiClient.mutation("account", "setTimeZone")
