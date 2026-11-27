import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Faucet } from "./Faucet.ts"

export const FaucetHandlers = HttpApiBuilder.group(
  BluechipApi,
  "faucet",
  Effect.fn(function*(handlers) {
    const faucet = yield* Faucet

    return handlers.handleAll({
      allowance: Effect.fn(function*() {
        const user = yield* CurrentUser
        return yield* faucet.allowance(user.id)
      }),
      claim: Effect.fn(function*({ payload }) {
        const user = yield* CurrentUser
        return yield* faucet.claim({ id: user.id, account: user.account as `0x${string}` }, payload.amount)
      })
    })
  })
)
