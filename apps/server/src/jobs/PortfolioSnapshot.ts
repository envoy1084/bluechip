import { ChainClient } from "@bluechip/chain/ChainClient"
import { readMultipliers } from "@bluechip/chain/market/Multipliers"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { jobRuns } from "../db/schema/jobRuns.ts"
import { readMarketPrices } from "../market/MarketPrices.ts"
import { snapshotPortfolios } from "../portfolio/Snapshots.ts"

/** Snapshots every portfolio at current market prices, and records the run in `job_runs`. */
export const snapshotPortfolioValues = Effect.gen(function*() {
  const db = yield* Database
  const chain = yield* ChainClient
  const startedAt = yield* DateTime.now

  const multipliers = yield* readMultipliers(chain)
  const prices = yield* readMarketPrices(multipliers)
  const { accounts } = yield* snapshotPortfolios(prices)

  const [run] = yield* db.insert(jobRuns).values({
    id: typeid("job").toString() as `job_${string}`,
    task: "portfolio.snapshot",
    status: "succeeded",
    startedAt,
    finishedAt: yield* DateTime.now,
    detail: { network: chain.network, accounts, prices: prices.size }
  }).returning().pipe(Effect.orDie)
  return run!
}).pipe(Effect.withSpan("jobs.snapshotPortfolioValues"))
