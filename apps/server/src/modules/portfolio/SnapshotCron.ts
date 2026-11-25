import { ChainClient } from "@bluechip/chain/ChainClient"
import * as ClusterCron from "effect/cluster/ClusterCron"
import * as Cron from "effect/Cron"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../../platform/db/Database.ts"
import { jobRuns } from "../../platform/engine/tables.ts"
import { MarketPrices } from "../market/MarketPrices.ts"
import { PortfolioSnapshots } from "./PortfolioSnapshots.ts"

/**
 * Every portfolio's value every 4 hours on the hour, at prices read afresh, for the 30-day chart; each run is recorded
 * in `job_runs`. A run more than an hour late is skipped. The engine runs it once per schedule across instances.
 */
export const PortfolioSnapshotCron = ClusterCron.make({
  name: "portfolio.snapshot",
  cron: Cron.parseUnsafe("0 */4 * * *"),
  execute: Effect.gen(function*() {
    const db = yield* Database
    const chain = yield* ChainClient
    const market = yield* MarketPrices
    const snapshots = yield* PortfolioSnapshots
    const startedAt = yield* DateTime.now

    const prices = yield* market.read
    const { accounts } = yield* snapshots.record(prices)

    yield* db.insert(jobRuns).values({
      id: typeid("job").toString() as `job_${string}`,
      task: "portfolio.snapshot",
      status: "succeeded",
      startedAt,
      finishedAt: yield* DateTime.now,
      detail: { network: chain.network, accounts, prices: prices.size }
    }).pipe(Effect.orDie)
  }).pipe(Effect.withSpan("PortfolioSnapshotCron")),
  skipIfOlderThan: Duration.hours(1)
})
