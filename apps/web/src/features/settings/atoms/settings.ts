import type { RequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import { agentsReactivityKey, BluechipApiClient } from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

export const signOutAtom = BluechipApiClient.mutation("auth", "logout")

export const setDisplayNameAtom = BluechipApiClient.mutation("account", "setDisplayName")

/** On a network with play money: $1,000 of test USDC and ETH for gas, for the signed-in account. */
export const testMoneyAtom = BluechipApiClient.mutation("dev", "fund")

/** Removes every agent with one Face ID: one owner operation revokes all their sessions onchain. */
export const removeAllAgentsAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(requestId: RequestId) {
    const client = yield* BluechipApiClient
    const removal = yield* client.agents.removeAll({ payload: { requestId } })
    return yield* client.agents.confirmRemoveAll({
      params: { id: removal.id },
      payload: { credential: yield* signWithPasskey(removal.options) }
    })
  }),
  { reactivityKeys: [agentsReactivityKey] }
)
