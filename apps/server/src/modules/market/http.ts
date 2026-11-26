import { BluechipApi } from "@bluechip/domain/Api"
import { QuoteUnavailable } from "@bluechip/domain/Errors"
import { MINIMUM_BUY } from "@bluechip/domain/trading/Trade"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { marketStatus } from "./Calendar.ts"
import { Charts } from "./Charts.ts"
import { Quoter } from "./Quoter.ts"
import { Stocks } from "./Stocks.ts"

export const MarketHandlers = HttpApiBuilder.group(
  BluechipApi,
  "market",
  Effect.fn(function*(handlers) {
    const stockList = yield* Stocks
    const charts = yield* Charts
    const quoter = yield* Quoter

    return handlers.handleAll({
      status: () => Effect.map(DateTime.now, marketStatus),
      stocks: () => stockList.list,
      history: ({ params, query }) => charts.history(params.symbol, query.range),
      quote: ({ payload }) => {
        if ("usdc" in payload.amount && payload.amount.usdc < MINIMUM_BUY) {
          return Effect.fail(new QuoteUnavailable({ symbol: payload.symbol, reason: "belowMinimum" }))
        }
        return quoter.quote(
          "usdc" in payload.amount
            ? { symbol: payload.symbol, side: "buy", usdc: payload.amount.usdc }
            : { symbol: payload.symbol, side: "sell", shares: payload.amount.shares }
        )
      }
    })
  })
)
