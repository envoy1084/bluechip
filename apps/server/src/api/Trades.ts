import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Trades } from "../trading/Trades.ts"

export const TradesHandlers = HttpApiBuilder.group(BluechipApi, "trades", (handlers) =>
  handlers
    .handle("prepare", ({ payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const trading = yield* Trades
        return yield* trading.prepare(user, payload)
      }))
    .handle("confirm", ({ params, payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const trading = yield* Trades
        return yield* trading.confirm(user, params.id, payload.credential)
      }))
    .handle("trade", ({ params }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const trading = yield* Trades
        return yield* trading.find(user, params.id)
      })))
