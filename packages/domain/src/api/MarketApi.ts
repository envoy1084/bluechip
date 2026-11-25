/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { NotFound, NotTradable, QuoteUnavailable } from "../Errors.ts"
import { HistoryRange, MarketStatus, PricePoint, Quote, Stock, StockSymbol } from "../market/Market.ts"
import { Shares, Usdc } from "../market/Units.ts"

/**
 * The market, public: status, stocks with reference prices, price history and quotes. Prices then arrive live as
 * `PriceTick` events.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class MarketApi extends HttpApiGroup.make("market").add(
  HttpApiEndpoint.get("status", "/market/status", { success: MarketStatus }),
  HttpApiEndpoint.get("stocks", "/market/stocks", { success: Schema.Array(Stock) }),
  HttpApiEndpoint.get("history", "/market/stocks/:symbol/history", {
    params: { symbol: StockSymbol },
    query: { range: HistoryRange },
    success: Schema.Array(PricePoint)
  }),
  HttpApiEndpoint.post("quote", "/market/quotes", {
    payload: Schema.Struct({
      symbol: StockSymbol,
      side: Schema.Literals(["buy", "sell"]),
      /** Buy: the USDC to spend. Sell: the shares to sell. */
      amount: Schema.Union([Schema.Struct({ usdc: Usdc }), Schema.Struct({ shares: Shares })])
    }),
    success: Quote,
    error: [NotTradable, QuoteUnavailable, NotFound]
  })
) {}
