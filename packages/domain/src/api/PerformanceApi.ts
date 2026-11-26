/**
 * @since 0.0.0
 */
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import { Authentication } from "../Auth.ts"
import { NotFound } from "../Errors.ts"
import { AgentId, AutomationId } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"
import {
  AgentPerformance,
  AutomationPerformance,
  PortfolioPerformance,
  StockPerformance
} from "../performance/Performance.ts"

/**
 * How the signed-in user is doing, from the ledger: the portfolio's profit and costs, and each stock's, agent's and
 * automation's contribution. They move with every fill; refetch on `TradeUpdated` and `PortfolioChanged`.
 *
 * @stability unstable
 * @category groups
 * @since 0.0.0
 */
export class PerformanceApi extends HttpApiGroup.make("performance").add(
  HttpApiEndpoint.get("portfolio", "/performance", { success: PortfolioPerformance }),
  HttpApiEndpoint.get("stock", "/performance/stocks/:symbol", {
    params: { symbol: StockSymbol },
    success: StockPerformance
  }),
  HttpApiEndpoint.get("agent", "/performance/agents/:id", {
    params: { id: AgentId },
    success: AgentPerformance,
    error: NotFound
  }),
  HttpApiEndpoint.get("automation", "/performance/automations/:id", {
    params: { id: AutomationId },
    success: AutomationPerformance,
    error: NotFound
  })
).middleware(Authentication) {}
