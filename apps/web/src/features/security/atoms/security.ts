import type { PasskeyId, RequestId, SessionId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import { BluechipApiClient, liveReactivityKey, securityReactivityKey } from "../../../lib/api/client.ts"
import { createPasskey, signWithPasskey } from "../../../lib/passkey.ts"

const keys = [securityReactivityKey, liveReactivityKey]

/** The account's owner passkeys; refetched on every `AccountChanged`. */
export const passkeysAtom = BluechipApiClient.query("account", "passkeys", { reactivityKeys: keys })

/** The browsers signed in to the account. */
export const devicesAtom = BluechipApiClient.query("account", "devices", { reactivityKeys: keys })

/** Makes another passkey, then signs its addition as an owner with one of the account's passkeys (Face ID). */
export const addPasskeyAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(requestId: RequestId) {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.account.passkeyOptions()
    const credential = yield* createPasskey(ceremony.options)
    const change = yield* client.account.addPasskey({
      payload: { requestId, challengeId: ceremony.challengeId, credential }
    })
    return yield* client.account.confirmPasskeyChange({
      params: { id: change.id },
      payload: { credential: yield* signWithPasskey(change.options) }
    })
  }),
  { reactivityKeys: keys }
)

/** Removes one of the account's passkeys, signed with another (or the same) passkey. */
export const removePasskeyAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(input: { readonly id: PasskeyId; readonly requestId: RequestId }) {
    const client = yield* BluechipApiClient
    const change = yield* client.account.removePasskey({
      params: { id: input.id },
      payload: { requestId: input.requestId }
    })
    return yield* client.account.confirmPasskeyChange({
      params: { id: change.id },
      payload: { credential: yield* signWithPasskey(change.options) }
    })
  }),
  { reactivityKeys: keys }
)

/** Signs one device out. */
export const signOutDeviceAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(id: SessionId) {
    const client = yield* BluechipApiClient
    yield* client.account.signOutDevice({ params: { id } })
  }),
  { reactivityKeys: keys }
)

/** Signs out every device but this one. */
export const signOutOthersAtom = BluechipApiClient.mutation("account", "signOutOthers")

/** Makes the recovery passkey (on another device or a hardware key) and locks it with Face ID. */
export const setUpRecoveryAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(requestId: RequestId) {
    const client = yield* BluechipApiClient
    const ceremony = yield* client.accountRecovery.keyOptions()
    const credential = yield* createPasskey(ceremony.options)
    const change = yield* client.accountRecovery.setUp({
      payload: { requestId, challengeId: ceremony.challengeId, credential }
    })
    return yield* client.accountRecovery.confirmKey({
      params: { id: change.id },
      payload: { credential: yield* signWithPasskey(change.options) }
    })
  }),
  { reactivityKeys: keys }
)

/** Removes the recovery passkey with Face ID: its session and the guard's are revoked onchain. */
export const removeRecoveryKeyAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(requestId: RequestId) {
    const client = yield* BluechipApiClient
    const change = yield* client.accountRecovery.removeKey({ payload: { requestId } })
    return yield* client.accountRecovery.confirmKey({
      params: { id: change.id },
      payload: { credential: yield* signWithPasskey(change.options) }
    })
  }),
  { reactivityKeys: keys }
)
