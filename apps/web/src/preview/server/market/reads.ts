// The mock API's market, portfolio, performance and activity groups, answered from the market slice.
import { ActivityItem } from "@bluechip/domain/activity/Activity"
import { BluechipApi } from "@bluechip/domain/Api"
import { NotFound } from "@bluechip/domain/Errors"
import { PricePoint } from "@bluechip/domain/market/Market"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { findAutomation } from "../../world/agents.ts"
import {
  agentPerformanceOf,
  automationPerformanceOf,
  portfolioPerformanceOf,
  stockPerformanceOf
} from "../../world/market/performance.ts"
import { historyOf, toPrice } from "../../world/market/prices.ts"
import { utc } from "../../world/market/records.ts"
import { quoteOf } from "../../world/market/trading.ts"
import { marketStatusOf, portfolioHistoryOf, portfolioOf, stocksOf } from "../../world/market/valuation.ts"
import { Preview } from "../Preview.ts"

const DAY = 24 * 3_600_000

/** One page of `items` from an offset token. */
export const pageOf = <A>(
  items: ReadonlyArray<A>,
  query: { readonly pageSize?: number; readonly pageToken?: string }
) => {
  const size = query.pageSize ?? 25
  const offset = Number(query.pageToken ?? "0") || 0
  return {
    items: items.slice(offset, offset + size),
    nextPageToken: offset + size < items.length ? String(offset + size) : null
  }
}

export const MarketHandlers = HttpApiBuilder.group(
  BluechipApi,
  "market",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      status: () => Effect.sync(() => marketStatusOf(preview.world.market, Date.now())),
      stocks: () => Effect.sync(() => stocksOf(preview.world.market, Date.now())),
      history: ({ params, query }) =>
        Effect.sync(() => {
          const market = preview.world.market
          const live = market.prices.get(params.symbol)
          if (live === undefined || (market.missingPrice && params.symbol === "SPCX")) return []
          return historyOf(market.book, live, query.range, Date.now()).map((point) =>
            new PricePoint({ at: utc(point.at), price: toPrice(point.price) })
          )
        }),
      quote: ({ payload }) =>
        Effect.suspend(() =>
          Effect.fromResult(
            quoteOf(preview.world.market, Date.now(), {
              symbol: payload.symbol,
              side: payload.side,
              amount: payload.amount
            })
          )
        )
    })
  })
)

export const PortfolioHandlers = HttpApiBuilder.group(
  BluechipApi,
  "portfolio",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      portfolio: () => Effect.sync(() => portfolioOf(preview.world.market, Date.now())),
      history: () => Effect.sync(() => portfolioHistoryOf(preview.world.market, Date.now()))
    })
  })
)

export const PerformanceHandlers = HttpApiBuilder.group(
  BluechipApi,
  "performance",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      portfolio: () => Effect.sync(() => portfolioPerformanceOf(preview.world, Date.now())),
      stock: ({ params }) => Effect.sync(() => stockPerformanceOf(preview.world.market, params.symbol, Date.now())),
      agent: ({ params }) =>
        Effect.suspend(() => {
          const performance = agentPerformanceOf(preview.world, params.id, Date.now())
          return performance === undefined ?
            Effect.fail(new NotFound({ resource: "agent", id: params.id })) :
            Effect.succeed(performance)
        }),
      automation: ({ params }) =>
        Effect.suspend(() => {
          const record = findAutomation(preview.world.agents, params.id)
          return record === undefined || record.automation.status === "deleted" ?
            Effect.fail(new NotFound({ resource: "automation", id: params.id })) :
            Effect.succeed(automationPerformanceOf(preview.world, params.id, record.runs))
        })
    })
  })
)

export const ActivityHandlers = HttpApiBuilder.group(
  BluechipApi,
  "activity",
  Effect.fn(function*(handlers) {
    const preview = yield* Preview

    return handlers.handleAll({
      list: ({ query }) =>
        Effect.sync(() => {
          const market = preview.world.market
          const kind = query.kind ?? "all"
          const period = query.period ?? "all"
          const since = period === "all" ? -Infinity : Date.now() - (period === "7d" ? 7 : 30) * DAY

          const items = [
            ...(kind === "cash" ? [] : market.trades.map(({ trade }) => ({
              at: trade.createdAt.epochMilliseconds,
              item: ActivityItem.cases.Trade.make({ trade })
            }))),
            ...(kind === "trades" ? [] : market.transfers.map((transfer) => ({
              at: transfer.createdAt.epochMilliseconds,
              item: ActivityItem.cases.Withdrawal.make({ transfer })
            })))
          ].filter((entry) => entry.at >= since).sort((a, b) => b.at - a.at).map((entry) => entry.item)

          return pageOf(items, { ...query, pageSize: query.pageSize ?? 20 })
        })
    })
  })
)
