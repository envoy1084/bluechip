import { accountReactivityKey, BluechipApiClient } from "../../../lib/api/client.ts"

export const passkeysAtom = BluechipApiClient.query("account", "passkeys", { reactivityKeys: [accountReactivityKey] })

export const signOutAtom = BluechipApiClient.mutation("auth", "logout")

export const setDisplayNameAtom = BluechipApiClient.mutation("account", "setDisplayName")
