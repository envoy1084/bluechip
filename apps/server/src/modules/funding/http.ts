import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Transfers } from "./Transfers.ts"
import { Withdrawals } from "./Withdrawals.ts"

export const TransfersHandlers = HttpApiBuilder.group(
  BluechipApi,
  "transfers",
  Effect.fn(function*(handlers) {
    const transfers = yield* Transfers
    const withdrawals = yield* Withdrawals

    return handlers.handleAll({
      list: ({ query }) => CurrentUser.use((user) => transfers.list(user.id, query)),
      prepareWithdrawal: ({ payload }) => CurrentUser.use((user) => withdrawals.prepare(user, payload)),
      confirmWithdrawal: ({ params, payload }) =>
        CurrentUser.use((user) => withdrawals.confirm(user, params.id, payload.credential))
    })
  })
)
