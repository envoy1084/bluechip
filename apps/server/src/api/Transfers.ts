import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { listTransfers } from "../funding/TransferRecords.ts"
import { Withdrawals } from "../funding/Withdrawals.ts"

export const TransfersHandlers = HttpApiBuilder.group(BluechipApi, "transfers", (handlers) =>
  handlers
    .handle("list", ({ query }) => Effect.flatMap(CurrentUser, (user) => listTransfers(user.id, query)))
    .handle("prepareWithdrawal", ({ payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const withdrawals = yield* Withdrawals
        return yield* withdrawals.prepare(user, payload)
      }))
    .handle("confirmWithdrawal", ({ params, payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const withdrawals = yield* Withdrawals
        return yield* withdrawals.confirm(user, params.id, payload.credential)
      })))
