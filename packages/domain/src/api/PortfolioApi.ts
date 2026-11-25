/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as Schema from "effect/Schema"
import { Authentication } from "../Auth.ts"
import { Unavailable } from "../Errors.ts"
import { Portfolio, PortfolioPoint } from "../portfolio/Portfolio.ts"

/**
 * The signed-in user's portfolio and its value over the last 30 days. Changes then arrive as `PortfolioChanged`
 * events, and values move with `PriceTick`s.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class PortfolioApi extends HttpApiGroup.make("portfolio").add(
  HttpApiEndpoint.get("portfolio", "/portfolio", { success: Portfolio, error: Unavailable }),
  HttpApiEndpoint.get("history", "/portfolio/history", { success: Schema.Array(PortfolioPoint) })
).middleware(Authentication) {}
