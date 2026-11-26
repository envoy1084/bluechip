// The mock API's market groups: market, portfolio, performance and activity (`market/reads.ts`), trades and intents
// (`market/trading.ts`), and prices that tick while the tab is open (`market/ticker.ts`).
import * as Layer from "effect/Layer"
import { ActivityHandlers, MarketHandlers, PerformanceHandlers, PortfolioHandlers } from "./market/reads.ts"
import { PriceTicker } from "./market/ticker.ts"
import { TradingGroupsLive } from "./market/trading.ts"

export const MarketGroupsLive = Layer.mergeAll(
  MarketHandlers,
  PortfolioHandlers,
  PerformanceHandlers,
  ActivityHandlers,
  TradingGroupsLive,
  PriceTicker
)
