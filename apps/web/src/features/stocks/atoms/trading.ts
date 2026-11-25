import type { SigningRequestId } from "@bluechip/domain/Ids"
import * as Effect from "effect/Effect"
import { BluechipApiClient } from "../../../lib/api/client.ts"
import { signWithPasskey } from "../../../lib/passkey.ts"

/** Quotes a trade on the server, checks it against Chainlink and returns what the passkey signs. */
export const prepareTradeAtom = BluechipApiClient.mutation("trades", "prepare")

/** Signs a prepared trade with the account's passkey (Face ID) and sends it. */
export const confirmTradeAtom = BluechipApiClient.runtime.fn(
  Effect.fnUntraced(function*(request: { readonly id: SigningRequestId; readonly options: Record<string, unknown> }) {
    const client = yield* BluechipApiClient
    const credential = yield* signWithPasskey(request.options)

    return yield* client.trades.confirm({
      params: { id: request.id },
      payload: { credential }
    })
  })
)
