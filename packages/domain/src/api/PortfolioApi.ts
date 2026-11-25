/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { HistoryRange } from "../market/Market.ts"
import { Portfolio, PortfolioPoint } from "../portfolio/Portfolio.ts"

/**
 * The signed-in user's portfolio and its value over time. Changes then arrive as `PortfolioChanged` events, and
 * values move with `PriceTick`s.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class PortfolioApi extends HttpApiGroup.make("portfolio").add(
  HttpApiEndpoint.get("portfolio", "/portfolio", { success: Portfolio }),
  HttpApiEndpoint.get("history", "/portfolio/history", {
    query: { range: HistoryRange },
    success: Schema.Array(PortfolioPoint)
  })
).middleware(Authentication) {}
