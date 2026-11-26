import { BluechipApiClient, intentsReactivityKey, liveReactivityKey } from "../lib/api/client.ts"

/** Agents' trades waiting for your Face ID, newest first. */
export const approvalsAtom = BluechipApiClient.query("intents", "approvals", {
  reactivityKeys: [intentsReactivityKey, liveReactivityKey]
})
