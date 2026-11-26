import { BluechipApiClient, liveReactivityKey, securityReactivityKey } from "../lib/api/client.ts"

/** The account's recovery passkey and its latest recovery; refetched on every `AccountChanged`. */
export const accountRecoveryAtom = BluechipApiClient.query("accountRecovery", "get", {
  reactivityKeys: [securityReactivityKey, liveReactivityKey]
})

/** Cancels the recovery waiting out its delay: no Face ID, since it only takes power away. */
export const cancelRecoveryAtom = BluechipApiClient.mutation("accountRecovery", "cancel")
