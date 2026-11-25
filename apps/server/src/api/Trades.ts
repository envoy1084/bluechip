import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import type { IntentRequest } from "@bluechip/domain/intents/Intent"
import { TradeRequest } from "@bluechip/domain/trading/Trade"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Intents } from "../intents/Intents.ts"
import { Trades } from "../trading/Trades.ts"

// The trade screens' endpoints: your own trades are intents like any other, prepared for your passkey.
export const TradesHandlers = HttpApiBuilder.group(BluechipApi, "trades", (handlers) =>
  handlers
    .handle("prepare", ({ payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const intents = yield* Intents
        const { requestId, ...leg } = payload
        const request = (yield* intents.create(user, { requestId, agentId: null, leg })) as IntentRequest
        return new TradeRequest({
          id: request.id,
          options: request.options,
          quote: request.quote,
          warnings: request.warnings,
          deploysAccount: request.deploysAccount,
          expiresAt: request.expiresAt
        })
      }))
    .handle("confirm", ({ params, payload }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const intents = yield* Intents
        const trading = yield* Trades
        const intent = yield* intents.confirm(user, params.id, payload.credential)
        return yield* trading.find(user, intent.tradeId!)
      }))
    .handle("trade", ({ params }) =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const trading = yield* Trades
        return yield* trading.find(user, params.id)
      })))
