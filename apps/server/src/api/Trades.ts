import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import type { IntentRequest } from "@bluechip/domain/intents/Intent"
import { TradeRequest } from "@bluechip/domain/trading/Trade"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { Intents } from "../intents/Intents.ts"
import { TradeLedger } from "../trading/TradeLedger.ts"

// The trade screens' endpoints: your own trades are intents like any other, prepared for your passkey.
export const TradesHandlers = HttpApiBuilder.group(
  BluechipApi,
  "trades",
  Effect.fn(function*(handlers) {
    const intents = yield* Intents
    const ledger = yield* TradeLedger

    return handlers.handleAll({
      prepare: Effect.fn(function*({ payload }) {
        const user = yield* CurrentUser
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
      }),
      confirm: Effect.fn(function*({ params, payload }) {
        const user = yield* CurrentUser
        const intent = yield* intents.confirm(user, params.id, payload.credential)
        return yield* ledger.find(user, intent.tradeId!)
      }),
      trade: ({ params }) => CurrentUser.use((user) => ledger.find(user, params.id))
    })
  })
)
