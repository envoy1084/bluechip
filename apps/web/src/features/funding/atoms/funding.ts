import type { SigningRequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import { BluechipApiClient, liveReactivityKey, portfolioReactivityKey } from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

/** Prepares a withdrawal: the server builds it and returns what the passkey signs. */
export const prepareWithdrawalAtom = BluechipApiClient.mutation("transfers", "prepareWithdrawal")

/** Signs a prepared withdrawal with the account's passkey (Face ID) and sends it. */
export const confirmWithdrawalAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.transfers.confirmWithdrawal({
      params: { id: request.id },
      payload: { credential }
    })
  }),
  { reactivityKeys: [portfolioReactivityKey, liveReactivityKey] }
)

/** Local development: test USDC and ETH for the signed-in account. */
export const devFundAtom = BluechipApiClient.mutation("dev", "fund")
