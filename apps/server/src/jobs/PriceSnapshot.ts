import { ChainClient } from "@bluechip/chain/ChainClient"
import { readPrices } from "@bluechip/chain/market/Prices"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { jobRuns } from "../db/schema/jobRuns.ts"
import { feedsPaused } from "../market/Calendar.ts"
import { recordPrices } from "../market/History.ts"

/** Stores every stock's latest feed answer for price history, and records the run in `job_runs`. */
export const snapshotPrices = Effect.gen(function*() {
  const db = yield* Database
  const chain = yield* ChainClient
  const startedAt = yield* DateTime.now
  // Nothing new to store while the feeds are paused (weekends, holidays): skip the RPC call.
  const { prices } = feedsPaused(startedAt) ? { prices: [] } : yield* readPrices(chain)
  yield* recordPrices(prices.map((feed) => ({
    symbol: feed.stock.symbol as StockSymbol,
    at: DateTime.makeUnsafe(feed.updatedAt),
    price: feed.price
  })))
  const [run] = yield* db.insert(jobRuns).values({
    id: typeid("job").toString() as `job_${string}`,
    task: "prices.snapshot",
    status: "succeeded",
    startedAt,
    finishedAt: yield* DateTime.now,
    detail: { network: chain.network, stocks: prices.length, skipped: prices.length === 0 }
  }).returning().pipe(Effect.orDie)
  return run!
}).pipe(Effect.withSpan("jobs.snapshotPrices"))
